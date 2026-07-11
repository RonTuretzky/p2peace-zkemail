// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice Incremental Merkle tree with a rolling history of recent roots
///         (Tornado/Semaphore lineage). Commitments are appended left-to-right; a
///         small ring buffer of past roots lets a withdrawal proof built against a
///         slightly-stale root still verify.
///
///         DEMO-TIER HASH. This uses keccak256 as the node hash. A production shielded
///         pool uses a SNARK-friendly hash (Poseidon) so the withdraw circuit can prove
///         membership cheaply; the keccak tree here is a faithful STRUCTURE (insert,
///         roots, history, fullness) for the mock-verifier tier. The tree hash and the
///         compiled withdraw circuit swap together — neither the pool's external
///         interface nor its accounting changes when they do.
abstract contract MerkleTreeWithHistory {
    uint32 public immutable levels;
    uint32 public constant ROOT_HISTORY_SIZE = 30;

    mapping(uint256 level => bytes32) public filledSubtrees;
    mapping(uint256 level => bytes32) public zeros;
    bytes32[ROOT_HISTORY_SIZE] public roots;
    uint32 public currentRootIndex;
    uint32 public nextIndex;

    constructor(uint32 levels_) {
        require(levels_ > 0 && levels_ < 32, "levels out of range");
        levels = levels_;
        bytes32 z = keccak256("p2peace/shielded-exit/zero");
        for (uint32 i = 0; i < levels_; i++) {
            zeros[i] = z;
            filledSubtrees[i] = z;
            z = _hashPair(z, z);
        }
        roots[0] = z;
    }

    function _hashPair(bytes32 l, bytes32 r) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(l, r));
    }

    /// @dev Append a leaf; recompute and store the new root in the history buffer.
    function _insert(bytes32 leaf) internal returns (uint32 index) {
        uint32 _next = nextIndex;
        require(_next < uint32(2) ** levels, "tree is full");
        uint32 idx = _next;
        bytes32 cur = leaf;
        bytes32 left;
        bytes32 right;
        for (uint32 i = 0; i < levels; i++) {
            if (idx % 2 == 0) {
                left = cur;
                right = zeros[i];
                filledSubtrees[i] = cur;
            } else {
                left = filledSubtrees[i];
                right = cur;
            }
            cur = _hashPair(left, right);
            idx /= 2;
        }
        uint32 newRootIndex = (currentRootIndex + 1) % ROOT_HISTORY_SIZE;
        currentRootIndex = newRootIndex;
        roots[newRootIndex] = cur;
        nextIndex = _next + 1;
        return _next;
    }

    /// @notice Whether `root` is the current root or one of the recent historical roots.
    function isKnownRoot(bytes32 root) public view returns (bool) {
        if (root == bytes32(0)) return false;
        uint32 i = currentRootIndex;
        for (uint32 c = 0; c < ROOT_HISTORY_SIZE; c++) {
            if (root == roots[i]) return true;
            if (i == 0) i = ROOT_HISTORY_SIZE;
            i--;
        }
        return false;
    }

    function getLastRoot() public view returns (bytes32) {
        return roots[currentRootIndex];
    }
}
