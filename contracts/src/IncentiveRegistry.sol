// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Community, Direction, SourceCategory} from "./Types.sol";
import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";
import {IIncentiveRegistry} from "./interfaces/IIncentiveRegistry.sol";

/// @notice Incentive proposal lifecycle:
///
///           propose (anyone, free, 30-day cooldown after a rejection)
///             → 7-day discussion (immutable on-chain; amendments = new proposal)
///             → 3-day quadratic vote (verified members only, n votes lock n² tokens)
///             → dual majority: YES > NO within community A *and* within community B,
///               with joint participation ≥ 30% of the member roll
///             → Active: EventAttestation accepts newsletter proofs against it.
///
///         The keyword logic is committed as `patternHash` — the hash of the exact
///         compiled zk-regex blueprint. Voters approve a circuit, not prose.
contract IncentiveRegistry is Ownable, IIncentiveRegistry {
    using SafeERC20 for IERC20;

    uint256 private constant BPS = 10_000;

    struct Incentive {
        address proposer;
        Direction direction;
        bytes32 patternHash;
        uint16 requiredA;
        uint16 requiredB;
        uint16 requiredIntl;
        uint32 attestationWindow;
        uint16 redistributionBps;
        uint16 maxTriggers;
        uint32 triggerCooldown;
        uint64 createdAt;
        bool finalized;
        bool passed;
        uint16 triggerCount;
        uint64 lastTriggeredAt;
        uint256 yesA;
        uint256 noA;
        uint256 yesB;
        uint256 noB;
        uint256 participants;
        string descriptionURI;
    }

    struct Ballot {
        address voter;
        Community community; // frozen at vote time; refunds must not depend on live membership
        uint256 locked;
        bool voted;
        bool refunded;
    }

    IIdentityRegistry public immutable registry;
    IERC20 public immutable tokenA;
    IERC20 public immutable tokenB;

    address public attestation; // may bump trigger bookkeeping
    address public engine; //      may roll back on reversal

    uint32 public discussionPeriod = 7 days;
    uint32 public votingPeriod = 3 days;
    uint16 public quorumBps = 3_000; //             30% of the member roll must vote
    uint16 public maxRedistributionBps = 500; //    ≤5% of pool/treasury per event
    uint32 public rejectionCooldown = 30 days;

    uint256 public incentiveCount;
    mapping(uint256 => Incentive) internal _incentives;
    mapping(uint256 => mapping(bytes32 domainHash => SourceCategory)) public sourceOf;
    mapping(uint256 => mapping(bytes32 nullifier => Ballot)) public ballots;
    mapping(address proposer => uint64) public cooldownUntil;

    event Proposed(uint256 indexed id, address indexed proposer, bytes32 patternHash);
    event Voted(
        uint256 indexed id, bytes32 indexed nullifier, Community community, bool support,
        uint256 votes
    );
    event Finalized(uint256 indexed id, bool passed);
    event StakeWithdrawn(uint256 indexed id, bytes32 indexed nullifier, uint256 amount);
    event Triggered(uint256 indexed id, uint16 triggerCount);
    event TriggerReversed(uint256 indexed id, uint16 triggerCount);
    event Wired(address attestation, address engine);
    event ParamsSet(uint32 discussion, uint32 voting, uint16 quorumBps, uint16 maxBps);

    error AlreadyWired();
    error ProposerOnCooldown();
    error BadProposal();
    error NotInVoting();
    error NotActiveMember();
    error AlreadyVoted();
    error ZeroVotes();
    error VotingNotOver();
    error AlreadyFinalized();
    error NotFinalized();
    error NothingToWithdraw();
    error NotAttestation();
    error NotEngine();

    constructor(address owner_, IIdentityRegistry registry_, IERC20 tokenA_, IERC20 tokenB_)
        Ownable(owner_)
    {
        registry = registry_;
        tokenA = tokenA_;
        tokenB = tokenB_;
    }

    function wire(address attestation_, address engine_) external onlyOwner {
        if (attestation != address(0)) revert AlreadyWired();
        attestation = attestation_;
        engine = engine_;
        emit Wired(attestation_, engine_);
    }

    function setParams(
        uint32 discussionPeriod_,
        uint32 votingPeriod_,
        uint16 quorumBps_,
        uint16 maxRedistributionBps_
    ) external onlyOwner {
        require(
            discussionPeriod_ >= 1 days && votingPeriod_ >= 1 days && quorumBps_ <= BPS
                && maxRedistributionBps_ <= 2_000,
            BadProposal()
        );
        discussionPeriod = discussionPeriod_;
        votingPeriod = votingPeriod_;
        quorumBps = quorumBps_;
        maxRedistributionBps = maxRedistributionBps_;
        emit ParamsSet(discussionPeriod_, votingPeriod_, quorumBps_, maxRedistributionBps_);
    }

    // ---------------------------------------------------------------- propose

    struct ProposalInput {
        Direction direction;
        bytes32 patternHash;
        uint16 requiredA;
        uint16 requiredB;
        uint16 requiredIntl;
        uint32 attestationWindow;
        uint16 redistributionBps;
        uint16 maxTriggers;
        uint32 triggerCooldown;
        bytes32[] sourceDomains; // keccak256(lowercase domain) per approved sender
        SourceCategory[] categories; // matching category per domain
        string descriptionURI;
    }

    function propose(ProposalInput calldata input) external returns (uint256 id) {
        if (block.timestamp < cooldownUntil[msg.sender]) revert ProposerOnCooldown();
        if (
            input.patternHash == bytes32(0) || input.requiredA == 0 || input.requiredB == 0
                || input.requiredIntl == 0 || input.attestationWindow < 1 days
                || input.attestationWindow > 30 days || input.redistributionBps == 0
                || input.redistributionBps > maxRedistributionBps || input.maxTriggers == 0
                || input.triggerCooldown < input.attestationWindow
                || input.sourceDomains.length != input.categories.length
        ) revert BadProposal();

        id = ++incentiveCount;
        Incentive storage inc = _incentives[id];
        inc.proposer = msg.sender;
        inc.direction = input.direction;
        inc.patternHash = input.patternHash;
        inc.requiredA = input.requiredA;
        inc.requiredB = input.requiredB;
        inc.requiredIntl = input.requiredIntl;
        inc.attestationWindow = input.attestationWindow;
        inc.redistributionBps = input.redistributionBps;
        inc.maxTriggers = input.maxTriggers;
        inc.triggerCooldown = input.triggerCooldown;
        inc.createdAt = uint64(block.timestamp);
        inc.descriptionURI = input.descriptionURI;

        // Register sources and check each required category is satisfiable.
        uint256 haveA;
        uint256 haveB;
        uint256 haveIntl;
        for (uint256 i = 0; i < input.sourceDomains.length; i++) {
            SourceCategory cat = input.categories[i];
            if (
                cat == SourceCategory.None
                    || sourceOf[id][input.sourceDomains[i]] != SourceCategory.None
            ) {
                revert BadProposal(); // no unknown categories, no duplicate domains
            }
            sourceOf[id][input.sourceDomains[i]] = cat;
            if (cat == SourceCategory.CommunityA) haveA++;
            else if (cat == SourceCategory.CommunityB) haveB++;
            else haveIntl++;
        }
        if (haveA < input.requiredA || haveB < input.requiredB || haveIntl < input.requiredIntl) {
            revert BadProposal();
        }

        emit Proposed(id, msg.sender, input.patternHash);
    }

    // ------------------------------------------------------------------- vote

    /// @notice Cast `votes` votes, locking votes² whole tokens of your community's
    ///         PeaceToken until the vote is finalized. Quadratic cost is enforceable
    ///         because ballots are per-identity (nullifier), not per-wallet.
    function castVote(uint256 id, bool support, uint256 votes) external {
        Incentive storage inc = _incentives[id];
        uint256 votingStart = inc.createdAt + discussionPeriod;
        if (
            inc.createdAt == 0 || block.timestamp < votingStart
                || block.timestamp >= votingStart + votingPeriod
        ) revert NotInVoting();
        if (!registry.isActiveMember(msg.sender)) revert NotActiveMember();
        if (votes == 0) revert ZeroVotes();

        bytes32 nullifier = registry.nullifierOf(msg.sender);
        Ballot storage ballot = ballots[id][nullifier];
        if (ballot.voted) revert AlreadyVoted();

        Community community = registry.communityOf(msg.sender);
        uint256 cost = votes * votes * 1e18;
        (community == Community.A ? tokenA : tokenB).safeTransferFrom(
            msg.sender, address(this), cost
        );

        ballot.voter = msg.sender;
        ballot.community = community;
        ballot.locked = cost;
        ballot.voted = true;

        if (community == Community.A) {
            if (support) inc.yesA += votes;
            else inc.noA += votes;
        } else {
            if (support) inc.yesB += votes;
            else inc.noB += votes;
        }
        inc.participants += 1;
        emit Voted(id, nullifier, community, support, votes);
    }

    function finalize(uint256 id) external {
        Incentive storage inc = _incentives[id];
        if (inc.createdAt == 0) revert BadProposal();
        if (block.timestamp < inc.createdAt + discussionPeriod + votingPeriod) {
            revert VotingNotOver();
        }
        if (inc.finalized) revert AlreadyFinalized();
        inc.finalized = true;

        bool passed = inc.yesA > inc.noA && inc.yesB > inc.noB
            && inc.participants * BPS >= uint256(quorumBps) * registry.totalMembers();
        inc.passed = passed;
        if (!passed) cooldownUntil[inc.proposer] = uint64(block.timestamp) + rejectionCooldown;
        emit Finalized(id, passed);
    }

    /// @notice Reclaim quadratically locked tokens after finalization, win or lose.
    ///         Keyed by explicit nullifier and paid to the recorded voter wallet, so
    ///         wallet rotation or membership expiry between vote and withdrawal can
    ///         neither strand nor redirect the refund.
    function withdrawVoteStake(uint256 id, bytes32 nullifier) external {
        Incentive storage inc = _incentives[id];
        if (!inc.finalized) revert NotFinalized();
        Ballot storage ballot = ballots[id][nullifier];
        if (!ballot.voted || ballot.refunded || ballot.voter != msg.sender) {
            revert NothingToWithdraw();
        }
        ballot.refunded = true;
        (ballot.community == Community.A ? tokenA : tokenB).safeTransfer(
            msg.sender, ballot.locked
        );
        emit StakeWithdrawn(id, nullifier, ballot.locked);
    }

    // ------------------------------------------------------- protocol callbacks

    function onTriggered(uint256 id) external {
        if (msg.sender != attestation) revert NotAttestation();
        Incentive storage inc = _incentives[id];
        inc.triggerCount += 1;
        inc.lastTriggeredAt = uint64(block.timestamp);
        emit Triggered(id, inc.triggerCount);
    }

    /// @dev Council reversal invalidates the event, so it should not consume a
    ///      trigger slot. The cooldown clock deliberately stays — it is the
    ///      anti-refire throttle, and a reversed event is exactly the moment to
    ///      throttle.
    function onReversed(uint256 id) external {
        if (msg.sender != engine) revert NotEngine();
        Incentive storage inc = _incentives[id];
        if (inc.triggerCount > 0) inc.triggerCount -= 1;
        emit TriggerReversed(id, inc.triggerCount);
    }

    // ------------------------------------------------------------------ views

    function getIncentive(uint256 id) external view returns (IncentiveView memory v) {
        Incentive storage inc = _incentives[id];
        v = IncentiveView({
            proposer: inc.proposer,
            direction: inc.direction,
            patternHash: inc.patternHash,
            requiredA: inc.requiredA,
            requiredB: inc.requiredB,
            requiredIntl: inc.requiredIntl,
            attestationWindow: inc.attestationWindow,
            redistributionBps: inc.redistributionBps,
            maxTriggers: inc.maxTriggers,
            triggerCooldown: inc.triggerCooldown,
            triggerCount: inc.triggerCount,
            lastTriggeredAt: inc.lastTriggeredAt
        });
    }

    function isActive(uint256 id) external view returns (bool) {
        Incentive storage inc = _incentives[id];
        return inc.finalized && inc.passed && inc.triggerCount < inc.maxTriggers;
    }

    function sourceCategory(uint256 id, bytes32 domainHash)
        external
        view
        returns (SourceCategory)
    {
        return sourceOf[id][domainHash];
    }

    function tallies(uint256 id)
        external
        view
        returns (uint256 yesA, uint256 noA, uint256 yesB, uint256 noB, uint256 participants)
    {
        Incentive storage inc = _incentives[id];
        return (inc.yesA, inc.noA, inc.yesB, inc.noB, inc.participants);
    }
}
