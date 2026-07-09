// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IRedistributionEngine} from "./interfaces/IRedistributionEngine.sol";

/// @notice Multi-stakeholder council that can reverse a confirmed event during its
///         dispute window — and nothing else. Reversal requires YES from ≥75% of the
///         *entire* council (not just those voting), per the original proposal's
///         supermajority. Council composition (respected figures from both
///         communities, balanced seats) is governance's responsibility via the
///         timelocked owner.
contract DisputeCouncil is Ownable {
    uint256 private constant BPS = 10_000;
    uint256 public constant REVERSAL_THRESHOLD_BPS = 7_500;

    IRedistributionEngine public immutable engine;

    mapping(address => bool) public isMember;
    uint256 public memberCount;

    mapping(uint256 eventId => mapping(address member => bool)) public hasVoted;
    mapping(uint256 eventId => uint256) public reverseVotes;
    mapping(uint256 eventId => bool) public reversed;

    event MemberSet(address indexed member, bool isMember);
    event ReverseVote(uint256 indexed eventId, address indexed member, uint256 votes);
    event Reversed(uint256 indexed eventId);

    error NotMember();
    error AlreadyVoted();
    error AlreadyReversed();

    constructor(address owner_, IRedistributionEngine engine_) Ownable(owner_) {
        engine = engine_;
    }

    function setMember(address member, bool member_) external onlyOwner {
        if (isMember[member] == member_) return;
        isMember[member] = member_;
        if (member_) memberCount += 1;
        else memberCount -= 1;
        emit MemberSet(member, member_);
    }

    /// @notice Vote to reverse a pending event. Executes the reversal the moment the
    ///         75% threshold is met — the engine enforces that the dispute window is
    ///         still open and the event still pending.
    function voteReverse(uint256 eventId) external {
        if (!isMember[msg.sender]) revert NotMember();
        if (hasVoted[eventId][msg.sender]) revert AlreadyVoted();
        if (reversed[eventId]) revert AlreadyReversed();
        hasVoted[eventId][msg.sender] = true;
        uint256 votes = ++reverseVotes[eventId];
        emit ReverseVote(eventId, msg.sender, votes);

        if (votes * BPS >= REVERSAL_THRESHOLD_BPS * memberCount) {
            reversed[eventId] = true;
            engine.reverse(eventId);
            emit Reversed(eventId);
        }
    }
}
