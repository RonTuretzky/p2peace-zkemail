// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Community} from "./Types.sol";
import {PeaceToken} from "./PeaceToken.sol";
import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";
import {ICommunityPool} from "./interfaces/ICommunityPool.sol";

/// @notice A community's peace stake, in two strictly separated buckets:
///
///         * corpus — the 10% stake from every citizen mint. Never claimable; the
///           capital explicitly consented to be at risk against the community's own
///           side's aggression. Only the RedistributionEngine can move it.
///         * rewards — inflows from finalized redistribution, treasury payouts and
///           escrow releases. Claimable by verified members, an equal share each
///           (accumulator pattern), keyed by identity nullifier so wallet rotation
///           keeps unclaimed rewards.
contract CommunityPool is Ownable, ICommunityPool {
    uint256 private constant ACC_PRECISION = 1e18;

    PeaceToken public immutable token;
    Community public immutable community;
    IIdentityRegistry public immutable registry;

    address public minter;
    address public engine;

    uint256 public corpusBalance;
    /// @dev cumulative rewards per member, scaled by ACC_PRECISION
    uint256 public accRewardPerMember;
    /// @dev rewards received while the member roll was empty, folded into the next inflow
    uint256 public pendingBuffer;
    mapping(bytes32 nullifier => uint256) public rewardCheckpoint;

    event Wired(address minter, address engine);
    event StakeDeposited(uint256 amount);
    event RewardDistributed(uint256 amount, uint256 memberCount);
    event CorpusSlashed(uint256 requested, uint256 actual);
    event Claimed(bytes32 indexed nullifier, address indexed wallet, uint256 amount);

    error AlreadyWired();
    error NotMinter();
    error NotEngine();
    error NotRegistry();
    error NotActiveMember();

    constructor(
        address owner_,
        PeaceToken token_,
        Community community_,
        IIdentityRegistry registry_
    ) Ownable(owner_) {
        token = token_;
        community = community_;
        registry = registry_;
    }

    function wire(address minter_, address engine_) external onlyOwner {
        if (minter != address(0)) revert AlreadyWired();
        minter = minter_;
        engine = engine_;
        emit Wired(minter_, engine_);
    }

    /// @notice Snapshot the accumulator for a new member so they only earn inflows
    ///         from enrollment onward.
    function initMember(bytes32 nullifier) external {
        if (msg.sender != address(registry)) revert NotRegistry();
        rewardCheckpoint[nullifier] = accRewardPerMember;
    }

    /// @dev Caller must have transferred/minted `amount` tokens to this pool first.
    function notifyStake(uint256 amount) external {
        if (msg.sender != minter) revert NotMinter();
        corpusBalance += amount;
        emit StakeDeposited(amount);
    }

    /// @dev Caller must have transferred/minted `amount` tokens to this pool first.
    function notifyReward(uint256 amount) external {
        if (msg.sender != minter && msg.sender != engine) revert NotMinter();
        uint256 count = registry.memberCount(community);
        if (count == 0) {
            pendingBuffer += amount;
        } else {
            accRewardPerMember += (amount + pendingBuffer) * ACC_PRECISION / count;
            pendingBuffer = 0;
        }
        emit RewardDistributed(amount, count);
    }

    function slashCorpus(uint256 amount) external returns (uint256 actual) {
        if (msg.sender != engine) revert NotEngine();
        actual = amount > corpusBalance ? corpusBalance : amount;
        corpusBalance -= actual;
        token.transfer(engine, actual);
        emit CorpusSlashed(amount, actual);
    }

    function claimable(address wallet) public view returns (uint256) {
        if (!registry.isActiveMember(wallet)) return 0;
        bytes32 nullifier = registry.nullifierOf(wallet);
        return (accRewardPerMember - rewardCheckpoint[nullifier]) / ACC_PRECISION;
    }

    function claim() external returns (uint256 amount) {
        if (!registry.isActiveMember(msg.sender)) revert NotActiveMember();
        bytes32 nullifier = registry.nullifierOf(msg.sender);
        amount = (accRewardPerMember - rewardCheckpoint[nullifier]) / ACC_PRECISION;
        rewardCheckpoint[nullifier] = accRewardPerMember;
        if (amount > 0) token.transfer(msg.sender, amount);
        emit Claimed(nullifier, msg.sender, amount);
    }
}
