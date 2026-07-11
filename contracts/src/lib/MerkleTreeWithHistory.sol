// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @dev circomlib Poseidon(2) hasher (deployed from circomlibjs-generated EVM bytecode),
///      so the on-chain tree hashes IDENTICALLY to the withdraw circuit.
interface IHasher {
    function poseidon(uint256[2] calldata input) external pure returns (uint256);
}

/// @notice Incremental Merkle tree with a rolling history of recent roots
///         (Tornado/Semaphore lineage), hashed with Poseidon so a Groth16 circuit can
///         prove membership cheaply. Node values are BN254 field elements.
abstract contract MerkleTreeWithHistory {
    uint32 public immutable levels;
    uint32 public constant ROOT_HISTORY_SIZE = 30;
    IHasher public immutable hasher;

    // Fixed zero leaf, shared byte-for-byte with the circuit's tree (zk/gen-proof.mjs).
    uint256 internal constant ZERO_VALUE =
        21663839004416932945382355908790599225266501822907911457504978515578255421292;

    mapping(uint256 level => uint256) public filledSubtrees;
    mapping(uint256 level => uint256) public zeros;
    uint256[ROOT_HISTORY_SIZE] public roots;
    uint32 public currentRootIndex;
    uint32 public nextIndex;

    constructor(uint32 levels_, IHasher hasher_) {
        require(levels_ > 0 && levels_ < 32, "levels out of range");
        levels = levels_;
        hasher = hasher_;
        uint256 z = ZERO_VALUE;
        for (uint32 i = 0; i < levels_; i++) {
            zeros[i] = z;
            filledSubtrees[i] = z;
            z = _hashPair(z, z);
        }
        roots[0] = z;
    }

    function _hashPair(uint256 l, uint256 r) internal view returns (uint256) {
        return hasher.poseidon([l, r]);
    }

    /// @dev Append a leaf; recompute and store the new root in the history buffer.
    function _insert(uint256 leaf) internal returns (uint32 index) {
        uint32 _next = nextIndex;
        require(_next < uint32(2) ** levels, "tree is full");
        uint32 idx = _next;
        uint256 cur = leaf;
        uint256 left;
        uint256 right;
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
    function isKnownRoot(uint256 root) public view returns (bool) {
        if (root == 0) return false;
        uint32 i = currentRootIndex;
        for (uint32 c = 0; c < ROOT_HISTORY_SIZE; c++) {
            if (root == roots[i]) return true;
            if (i == 0) i = ROOT_HISTORY_SIZE;
            i--;
        }
        return false;
    }

    function getLastRoot() public view returns (uint256) {
        return roots[currentRootIndex];
    }
}
