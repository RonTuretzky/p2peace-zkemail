// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ITreasury} from "./interfaces/ITreasury.sol";

/// @notice Shared war chest that pays for peace: outsider minting premiums and
///         donations flow in; positive-action rewards and cooperation bonuses flow
///         out through authorized protocol contracts.
contract Treasury is Ownable, ITreasury {
    using SafeERC20 for IERC20;

    IERC20 public immutable usd;
    mapping(address => bool) public spenders;

    event SpenderSet(address indexed spender, bool allowed);
    event Donation(address indexed from, uint256 amount);
    event Released(address indexed by, address indexed to, uint256 amount);

    error NotSpender();

    constructor(address owner_, IERC20 usd_) Ownable(owner_) {
        usd = usd_;
    }

    function setSpender(address spender, bool allowed) external onlyOwner {
        spenders[spender] = allowed;
        emit SpenderSet(spender, allowed);
    }

    function donate(uint256 amount) external {
        usd.safeTransferFrom(msg.sender, address(this), amount);
        emit Donation(msg.sender, amount);
    }

    function balance() external view returns (uint256) {
        return usd.balanceOf(address(this));
    }

    function release(address to, uint256 amount) external {
        if (!spenders[msg.sender]) revert NotSpender();
        usd.safeTransfer(to, amount);
        emit Released(msg.sender, to, amount);
    }
}
