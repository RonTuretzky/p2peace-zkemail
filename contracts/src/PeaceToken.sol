// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Community} from "./Types.sol";

/// @notice One ERC-20 per community, fully reserve-backed: only its PeaceMinter may
///         mint or burn, and the minter holds one unit of reserve asset per token.
contract PeaceToken is ERC20, Ownable {
    Community public immutable community;
    address public minter;

    error NotMinter();
    error MinterAlreadySet();

    event MinterSet(address indexed minter);

    constructor(string memory name_, string memory symbol_, Community community_, address owner_)
        ERC20(name_, symbol_)
        Ownable(owner_)
    {
        community = community_;
    }

    function setMinter(address minter_) external onlyOwner {
        if (minter != address(0)) revert MinterAlreadySet();
        minter = minter_;
        emit MinterSet(minter_);
    }

    function mint(address to, uint256 amount) external {
        if (msg.sender != minter) revert NotMinter();
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        if (msg.sender != minter) revert NotMinter();
        _burn(from, amount);
    }
}
