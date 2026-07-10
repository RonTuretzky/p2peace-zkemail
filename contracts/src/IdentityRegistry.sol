// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Community, EmailProof} from "./Types.sol";
import {IZKEmailVerifier} from "./interfaces/IZKEmailVerifier.sol";
import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";
import {ICommunityPool} from "./interfaces/ICommunityPool.sol";
import {RealEmailVerifier} from "./RealEmailVerifier.sol";

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

    // --- real-email path (fully on-chain DKIM/RSA verification, no ZK) ---
    RealEmailVerifier public realVerifier;
    /// keyId → the community a genuine email from that DKIM key enrolls into.
    mapping(bytes32 realKeyId => Community) public realKeyCommunity;
    /// keyId → the exact sender address the From header must carry.
    mapping(bytes32 realKeyId => string) public realKeySender;

    event DomainSet(bytes32 indexed domainHash, Community community);
    event CitizenshipPatternSet(bytes32 indexed patternHash, bool approved);
    event Registered(
        address indexed wallet, Community indexed community, bytes32 indexed nullifier
    );
    event Renewed(address indexed wallet, uint64 expiresAt);
    event WalletRotated(bytes32 indexed nullifier, address indexed from, address indexed to);
    event PoolsSet(address poolA, address poolB);
    event RealVerifierSet(address verifier);
    event RealKeyMapped(bytes32 indexed keyId, Community community, string sender);

    error InvalidProof();
    error DomainNotAllowlisted();
    error PatternNotApproved();
    error StaleProof();
    error FutureProof();
    error ProofReplayed();
    error WalletAlreadyMember();
    error CommunityMismatch();
    error RealPathDisabled();
    error RealKeyNotMapped();

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

        _enroll(p.nullifier, wallet, community);
    }

    // --------------------------------------------------- real-email enrollment

    function setRealVerifier(RealEmailVerifier verifier_) external onlyOwner {
        realVerifier = verifier_;
        emit RealVerifierSet(address(verifier_));
    }

    /// @notice Map a real DKIM key (in the RealEmailVerifier) to the community it
    ///         enrolls, and the exact sender address its From header must carry.
    function setRealKey(bytes32 keyId, Community community, string calldata sender)
        external
        onlyOwner
    {
        realKeyCommunity[keyId] = community;
        realKeySender[keyId] = sender;
        emit RealKeyMapped(keyId, community, sender);
    }

    /// @notice Register with a *real* email — fully on-chain DKIM/RSA verification,
    ///         no ZK, no mock. `signedHeaders` are the canonicalized DKIM-signed
    ///         header bytes and `signature` the RSA signature; the RealEmailVerifier
    ///         proves the email was genuinely signed by the domain and extracts the
    ///         recipient nullifier from the signed bytes.
    ///
    ///         Trade-off (honest): the signed headers, including the recipient
    ///         address, are public calldata. This proves authenticity, not privacy —
    ///         the ZK path keeps the email private. Freshness is not enforced
    ///         on-chain here (the signed Date is present but RFC-2822 parsing on-chain
    ///         is out of scope); the per-recipient nullifier still guarantees one
    ///         membership per inbox.
    function registerReal(
        bytes32 keyId,
        bytes calldata signedHeaders,
        bytes calldata signature,
        address wallet
    ) external {
        _enroll(_verifyReal(keyId, signedHeaders, signature), wallet, realKeyCommunity[keyId]);
    }

    function _verifyReal(bytes32 keyId, bytes calldata signedHeaders, bytes calldata signature)
        internal
        view
        returns (bytes32)
    {
        RealEmailVerifier rv = realVerifier;
        if (address(rv) == address(0)) revert RealPathDisabled();
        if (realKeyCommunity[keyId] == Community.None) revert RealKeyNotMapped();
        return rv.verifyIdentityEmail(keyId, signedHeaders, signature, realKeySender[keyId]);
    }

    // ------------------------------------------------------------------ internal

    function _enroll(bytes32 nullifier, address wallet, Community community) internal {
        address current = nullifierWallet[nullifier];
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
            emit WalletRotated(nullifier, current, wallet);
        } else {
            // Fresh enrollment.
            _memberCount[community] += 1;
            ICommunityPool pool = pools[community];
            if (address(pool) != address(0)) pool.initMember(nullifier);
        }

        members[wallet] = Member({
            community: community,
            nullifier: nullifier,
            registeredAt: uint64(block.timestamp),
            expiresAt: expiresAt
        });
        nullifierWallet[nullifier] = wallet;
        emit Registered(wallet, community, nullifier);
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
