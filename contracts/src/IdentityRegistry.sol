// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Community, EmailProof} from "./Types.sol";
import {IZKEmailVerifier} from "./interfaces/IZKEmailVerifier.sol";
import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";
import {ICommunityPool} from "./interfaces/ICommunityPool.sol";

/// @notice Sybil-resistant community roll built on zkEmail citizenship proofs.
///
///         A proof shows control of an email account that receives DKIM-signed mail
///         from an allowlisted government domain. Its nullifier is
///         Poseidon(recipientAddress, salt) — constant per email account — so each
///         account enrolls exactly one wallet at a time. The target wallet is bound
///         inside the proof (extraData public input), so a stolen proof cannot be
///         redirected, and the strictly-increasing email-timestamp rule makes every
///         used proof single-shot.
contract IdentityRegistry is Ownable, IIdentityRegistry {
    struct Member {
        Community community;
        bytes32 nullifier;
        uint64 registeredAt;
        uint64 expiresAt;
    }

    IZKEmailVerifier public immutable verifier;

    uint64 public maxProofAge = 90 days; //         email must be recent
    uint64 public membershipDuration = 365 days; // renewable with a fresh proof
    uint64 public constant FUTURE_SLACK = 1 hours; // sender clock skew allowance

    mapping(bytes32 domainHash => Community) public domainCommunity;
    mapping(bytes32 patternHash => bool) public citizenshipPatterns;
    mapping(address wallet => Member) public members;
    mapping(bytes32 nullifier => address wallet) public nullifierWallet;
    mapping(bytes32 nullifier => uint64) public lastProofTimestamp;
    mapping(Community => uint256) private _memberCount;
    mapping(Community => ICommunityPool) public pools;

    event DomainSet(bytes32 indexed domainHash, Community community);
    event CitizenshipPatternSet(bytes32 indexed patternHash, bool approved);
    event Registered(
        address indexed wallet, Community indexed community, bytes32 indexed nullifier
    );
    event Renewed(address indexed wallet, uint64 expiresAt);
    event WalletRotated(bytes32 indexed nullifier, address indexed from, address indexed to);
    event PoolsSet(address poolA, address poolB);

    error InvalidProof();
    error DomainNotAllowlisted();
    error PatternNotApproved();
    error StaleProof();
    error FutureProof();
    error ProofReplayed();
    error WalletAlreadyMember();
    error CommunityMismatch();

    constructor(address owner_, IZKEmailVerifier verifier_) Ownable(owner_) {
        verifier = verifier_;
    }

    // ------------------------------------------------------------------ admin

    function setDomain(bytes32 domainHash, Community community) external onlyOwner {
        domainCommunity[domainHash] = community;
        emit DomainSet(domainHash, community);
    }

    function setCitizenshipPattern(bytes32 patternHash, bool approved) external onlyOwner {
        citizenshipPatterns[patternHash] = approved;
        emit CitizenshipPatternSet(patternHash, approved);
    }

    function setPools(ICommunityPool poolA, ICommunityPool poolB) external onlyOwner {
        pools[Community.A] = poolA;
        pools[Community.B] = poolB;
        emit PoolsSet(address(poolA), address(poolB));
    }

    function setDurations(uint64 maxProofAge_, uint64 membershipDuration_) external onlyOwner {
        maxProofAge = maxProofAge_;
        membershipDuration = membershipDuration_;
    }

    // ------------------------------------------------------------- enrollment

    /// @notice Enroll, renew, or rotate. Anyone may relay a proof; the enrolled
    ///         wallet is the one baked into the proof itself.
    function register(EmailProof calldata p, address wallet) external {
        if (!verifier.verify(p, uint256(uint160(wallet)))) revert InvalidProof();

        Community community = domainCommunity[p.domainHash];
        if (community == Community.None) revert DomainNotAllowlisted();
        if (!citizenshipPatterns[p.patternHash]) revert PatternNotApproved();
        if (block.timestamp > uint256(p.emailTimestamp) + maxProofAge) revert StaleProof();
        if (p.emailTimestamp > block.timestamp + FUTURE_SLACK) revert FutureProof();
        // Each physical email is usable once: any later action needs a newer email.
        if (p.emailTimestamp <= lastProofTimestamp[p.nullifier]) revert ProofReplayed();
        lastProofTimestamp[p.nullifier] = p.emailTimestamp;

        address current = nullifierWallet[p.nullifier];
        uint64 expiresAt = uint64(block.timestamp) + membershipDuration;

        if (current == wallet) {
            // Renewal.
            members[wallet].expiresAt = expiresAt;
            emit Renewed(wallet, expiresAt);
            return;
        }

        if (members[wallet].community != Community.None) revert WalletAlreadyMember();

        if (current != address(0)) {
            // Rotation: same email account, new wallet. Unclaimed pool rewards are
            // keyed by nullifier, so they follow the member.
            if (members[current].community != community) revert CommunityMismatch();
            delete members[current];
            emit WalletRotated(p.nullifier, current, wallet);
        } else {
            // Fresh enrollment.
            _memberCount[community] += 1;
            ICommunityPool pool = pools[community];
            if (address(pool) != address(0)) pool.initMember(p.nullifier);
        }

        members[wallet] = Member({
            community: community,
            nullifier: p.nullifier,
            registeredAt: uint64(block.timestamp),
            expiresAt: expiresAt
        });
        nullifierWallet[p.nullifier] = wallet;
        emit Registered(wallet, community, p.nullifier);
    }

    // ------------------------------------------------------------------ views

    function isActiveMember(address wallet) public view returns (bool) {
        Member storage m = members[wallet];
        return m.community != Community.None && block.timestamp <= m.expiresAt;
    }

    function communityOf(address wallet) external view returns (Community) {
        return members[wallet].community;
    }

    function nullifierOf(address wallet) external view returns (bytes32) {
        return members[wallet].nullifier;
    }

    /// @dev Counts enrolled email accounts, including lapsed-but-renewable ones:
    ///      lapsed members keep diluting quorum until they renew or the roll is
    ///      pruned by governance policy. Cheap renewals make this acceptable for v1.
    function memberCount(Community community) external view returns (uint256) {
        return _memberCount[community];
    }

    function totalMembers() external view returns (uint256) {
        return _memberCount[Community.A] + _memberCount[Community.B];
    }
}
