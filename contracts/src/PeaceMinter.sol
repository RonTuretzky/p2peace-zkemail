// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Community} from "./Types.sol";
import {PeaceToken} from "./PeaceToken.sol";
import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";
import {ICommunityPool} from "./interfaces/ICommunityPool.sol";
import {IPeaceMinter} from "./interfaces/IPeaceMinter.sol";

/// @notice Reserve-backed issuance for one community's PeaceToken.
///
///         Invariant: reserve (USD held here) == token.totalSupply(). Citizens mint
///         1:1 with a `poolBps` slice staked into their CommunityPool; outsiders pay
///         a premium of which only the par half backs tokens — the rest funds the
///         Treasury. Redemption is always 1:1 for anyone holding tokens.
contract PeaceMinter is Ownable, IPeaceMinter {
    using SafeERC20 for IERC20;

    uint256 private constant BPS = 10_000;

    IERC20 public immutable usd;
    PeaceToken public immutable token;
    ICommunityPool public immutable pool;
    IIdentityRegistry public immutable registry;
    Community public immutable community;
    address public immutable treasury;

    /// @notice slice of every citizen mint staked into the community pool
    uint256 public poolBps = 1_000; // 10%
    /// @notice outsider price per token, in bps of par (20000 = pay 2x)
    uint256 public premiumBps = 20_000;
    /// @notice contracts allowed to mint at par into the pool (engine, escrow)
    mapping(address => bool) public parMinters;

    event CitizenMint(address indexed to, uint256 usdIn, uint256 staked);
    event OutsiderMint(address indexed to, uint256 usdIn, uint256 tokensOut, uint256 premium);
    event Redeemed(address indexed from, uint256 amount);
    event ParMint(address indexed by, uint256 usdAmount);
    event ParamsSet(uint256 poolBps, uint256 premiumBps);
    event ParMinterSet(address indexed account, bool allowed);

    error NotCitizen();
    error CitizenMustUseCitizenMint();
    error NotParMinter();
    error BadParams();

    constructor(
        address owner_,
        IERC20 usd_,
        PeaceToken token_,
        ICommunityPool pool_,
        IIdentityRegistry registry_,
        address treasury_
    ) Ownable(owner_) {
        usd = usd_;
        token = token_;
        pool = pool_;
        registry = registry_;
        community = token_.community();
        treasury = treasury_;
    }

    function setParams(uint256 poolBps_, uint256 premiumBps_) external onlyOwner {
        // stake capped at 20%; premium between 1x and 5x
        if (poolBps_ > 2_000 || premiumBps_ < BPS || premiumBps_ > 50_000) revert BadParams();
        poolBps = poolBps_;
        premiumBps = premiumBps_;
        emit ParamsSet(poolBps_, premiumBps_);
    }

    function setParMinter(address account, bool allowed) external onlyOwner {
        parMinters[account] = allowed;
        emit ParMinterSet(account, allowed);
    }

    /// @notice Verified members of this community mint 1:1. `poolBps` of the mint is
    ///         staked into the community pool — buying in *is* signing the
    ///         rebalancing agreement.
    function mintCitizen(uint256 usdAmount) external {
        if (!registry.isActiveMember(msg.sender) || registry.communityOf(msg.sender) != community) {
            revert NotCitizen();
        }
        usd.safeTransferFrom(msg.sender, address(this), usdAmount);
        uint256 stake = usdAmount * poolBps / BPS;
        if (stake > 0) {
            token.mint(address(pool), stake);
            pool.notifyStake(stake);
        }
        token.mint(msg.sender, usdAmount - stake);
        emit CitizenMint(msg.sender, usdAmount, stake);
    }

    /// @notice Anyone who is not a verified member of this community mints at the
    ///         premium price. Par value backs the tokens; the premium funds the
    ///         Treasury. No pool stake, no vote — outsider skin-in-the-game is the
    ///         premium itself.
    function mintOutsider(uint256 usdAmount) external {
        if (registry.isActiveMember(msg.sender) && registry.communityOf(msg.sender) == community) {
            revert CitizenMustUseCitizenMint();
        }
        usd.safeTransferFrom(msg.sender, address(this), usdAmount);
        uint256 tokens = usdAmount * BPS / premiumBps;
        uint256 premium = usdAmount - tokens;
        if (premium > 0) usd.safeTransfer(treasury, premium);
        token.mint(msg.sender, tokens);
        emit OutsiderMint(msg.sender, usdAmount, tokens, premium);
    }

    /// @notice Burn tokens for reserve asset, 1:1, no questions asked.
    function redeem(uint256 tokenAmount) external {
        token.burn(msg.sender, tokenAmount);
        usd.safeTransfer(msg.sender, tokenAmount);
        emit Redeemed(msg.sender, tokenAmount);
    }

    /// @notice Protocol-internal issuance: pull USD from the caller, mint 1:1 into
    ///         the community pool as claimable rewards. Reserve invariant holds.
    function mintAtPar(uint256 usdAmount) external {
        if (!parMinters[msg.sender]) revert NotParMinter();
        usd.safeTransferFrom(msg.sender, address(this), usdAmount);
        token.mint(address(pool), usdAmount);
        pool.notifyReward(usdAmount);
        emit ParMint(msg.sender, usdAmount);
    }
}
