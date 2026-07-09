// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Community} from "./Types.sol";
import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";
import {ITreasury} from "./interfaces/ITreasury.sol";

/// @notice Peace-abiding business certification and the cross-community
///         cooperation bonus.
///
///         Certification is a 3-day one-member-one-vote poll needing a simple
///         majority in *each* community (lighter than incentive votes — it is
///         reversible by the mirror-image revocation poll). Certified businesses
///         paid by a verified member of the *other* community receive a Treasury
///         bonus on top — commerce across the conflict line is subsidized by the
///         war chest.
contract BusinessRegistry is Ownable {
    uint256 private constant BPS = 10_000;

    enum BizStatus {
        None,
        CertVote,
        Certified,
        Rejected,
        RevokeVote,
        Revoked
    }

    struct Business {
        address wallet;
        Community community;
        string metadataURI;
        BizStatus status;
        uint64 votingEnd;
        uint64 session; // bumps every poll; invalidates prior per-nullifier votes
        uint256 yesA;
        uint256 noA;
        uint256 yesB;
        uint256 noB;
    }

    IIdentityRegistry public immutable registry;
    ITreasury public immutable treasury;
    IERC20 public immutable tokenA;
    IERC20 public immutable tokenB;

    uint32 public votingPeriod = 3 days;
    uint16 public cooperationBonusBps = 200; // 2%, paid in reserve asset

    /// @dev Wash-trade containment. A certified business colluding with (or owned by)
    ///      a member of the other community can loop costless token transfers and
    ///      milk the bonus, so total bonus outflow is budgeted per epoch: at most
    ///      `epochBudgetBps` of the Treasury (snapshotted when the epoch opens) is
    ///      paid out across ALL businesses per `bonusEpoch`. That bounds worst-case
    ///      drain to ~1% / 30 days — slower than the 3-day revocation poll that is
    ///      the actual remedy against a washing business.
    uint16 public epochBudgetBps = 100; // 1% of treasury per epoch
    uint32 public bonusEpoch = 30 days;
    uint64 public epochStart;
    uint256 public epochBudget;
    uint256 public epochSpent;

    uint256 public businessCount;
    mapping(uint256 => Business) public businesses;
    mapping(uint256 bizId => mapping(bytes32 nullifier => uint64 session)) public votedInSession;

    event Applied(uint256 indexed bizId, address indexed wallet, Community community);
    event RevocationOpened(uint256 indexed bizId, address indexed by);
    event BizVote(uint256 indexed bizId, bytes32 indexed nullifier, bool support);
    event BizFinalized(uint256 indexed bizId, BizStatus status);
    event Paid(
        uint256 indexed bizId, address indexed payer, uint256 amount, uint256 cooperationBonus
    );
    event BonusSet(uint16 bps);
    event EpochBudgetSet(uint16 budgetBps, uint32 epoch);
    event EpochRolled(uint64 epochStart, uint256 budget);

    error NotActiveMember();
    error BadBusiness();
    error NotVoting();
    error VotingClosed();
    error VotingStillOpen();
    error AlreadyVoted();
    error NotCertified();
    error BadParams();

    constructor(
        address owner_,
        IIdentityRegistry registry_,
        ITreasury treasury_,
        IERC20 tokenA_,
        IERC20 tokenB_
    ) Ownable(owner_) {
        registry = registry_;
        treasury = treasury_;
        tokenA = tokenA_;
        tokenB = tokenB_;
    }

    function setCooperationBonus(uint16 bps) external onlyOwner {
        if (bps > 1_000) revert BadParams();
        cooperationBonusBps = bps;
        emit BonusSet(bps);
    }

    function setEpochBudget(uint16 budgetBps, uint32 epoch) external onlyOwner {
        if (budgetBps > 1_000 || epoch < 1 days) revert BadParams();
        epochBudgetBps = budgetBps;
        bonusEpoch = epoch;
        emit EpochBudgetSet(budgetBps, epoch);
    }

    // ------------------------------------------------------------ certification

    function applyForCertification(Community community, string calldata metadataURI)
        external
        returns (uint256 bizId)
    {
        if (community == Community.None) revert BadBusiness();
        bizId = ++businessCount;
        Business storage b = businesses[bizId];
        b.wallet = msg.sender;
        b.community = community;
        b.metadataURI = metadataURI;
        _openPoll(b, BizStatus.CertVote);
        emit Applied(bizId, msg.sender, community);
    }

    /// @notice Any verified member can put a certified business up for revocation.
    function openRevocation(uint256 bizId) external {
        if (!registry.isActiveMember(msg.sender)) revert NotActiveMember();
        Business storage b = businesses[bizId];
        if (b.status != BizStatus.Certified) revert NotCertified();
        _openPoll(b, BizStatus.RevokeVote);
        emit RevocationOpened(bizId, msg.sender);
    }

    function vote(uint256 bizId, bool support) external {
        if (!registry.isActiveMember(msg.sender)) revert NotActiveMember();
        Business storage b = businesses[bizId];
        if (b.status != BizStatus.CertVote && b.status != BizStatus.RevokeVote) {
            revert NotVoting();
        }
        if (block.timestamp >= b.votingEnd) revert VotingClosed();

        bytes32 nullifier = registry.nullifierOf(msg.sender);
        if (votedInSession[bizId][nullifier] == b.session) revert AlreadyVoted();
        votedInSession[bizId][nullifier] = b.session;

        if (registry.communityOf(msg.sender) == Community.A) {
            if (support) b.yesA += 1;
            else b.noA += 1;
        } else {
            if (support) b.yesB += 1;
            else b.noB += 1;
        }
        emit BizVote(bizId, nullifier, support);
    }

    function _openPoll(Business storage b, BizStatus pollStatus) internal {
        b.status = pollStatus;
        b.votingEnd = uint64(block.timestamp) + votingPeriod;
        b.session += 1;
        b.yesA = 0;
        b.noA = 0;
        b.yesB = 0;
        b.noB = 0;
    }

    function finalizePoll(uint256 bizId) external {
        Business storage b = businesses[bizId];
        if (b.status != BizStatus.CertVote && b.status != BizStatus.RevokeVote) {
            revert NotVoting();
        }
        if (block.timestamp < b.votingEnd) revert VotingStillOpen();

        bool passed = b.yesA > b.noA && b.yesB > b.noB;
        if (b.status == BizStatus.CertVote) {
            b.status = passed ? BizStatus.Certified : BizStatus.Rejected;
        } else {
            // Revocation poll: passing revokes; failing restores certification.
            b.status = passed ? BizStatus.Revoked : BizStatus.Certified;
        }
        emit BizFinalized(bizId, b.status);
    }

    // ---------------------------------------------------------------- payments

    /// @notice Pay a certified business in the payer's community token. When payer
    ///         and business sit on opposite sides of the conflict line, the Treasury
    ///         tops the business up with a reserve-asset cooperation bonus (best
    ///         effort — capped by Treasury balance).
    function payBusiness(uint256 bizId, uint256 amount) external {
        Business storage b = businesses[bizId];
        if (b.status != BizStatus.Certified) revert NotCertified();
        if (!registry.isActiveMember(msg.sender)) revert NotActiveMember();

        Community payerCommunity = registry.communityOf(msg.sender);
        IERC20 token = payerCommunity == Community.A ? tokenA : tokenB;
        SafeERC20.safeTransferFrom(token, msg.sender, b.wallet, amount);

        uint256 bonus;
        if (payerCommunity != b.community) {
            bonus = amount * cooperationBonusBps / BPS;
            bonus = _consumeBonusBudget(bonus);
            uint256 available = treasury.balance();
            if (bonus > available) bonus = available;
            if (bonus > 0) treasury.release(b.wallet, bonus);
        }
        emit Paid(bizId, msg.sender, amount, bonus);
    }

    /// @dev Roll the epoch lazily, then grant at most what remains of its budget.
    function _consumeBonusBudget(uint256 requested) internal returns (uint256 granted) {
        if (epochStart == 0 || block.timestamp >= uint256(epochStart) + bonusEpoch) {
            epochStart = uint64(block.timestamp);
            epochBudget = treasury.balance() * epochBudgetBps / BPS;
            epochSpent = 0;
            emit EpochRolled(epochStart, epochBudget);
        }
        uint256 remaining = epochBudget - epochSpent;
        granted = requested > remaining ? remaining : requested;
        epochSpent += granted;
    }
}
