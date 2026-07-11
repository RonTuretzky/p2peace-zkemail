pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/mux1.circom";

// commitment = Poseidon(nullifier, secret) ; nullifierHash = Poseidon(nullifier)
template CommitmentHasher() {
    signal input nullifier;
    signal input secret;
    signal output commitment;
    signal output nullifierHash;

    component com = Poseidon(2);
    com.inputs[0] <== nullifier;
    com.inputs[1] <== secret;
    commitment <== com.out;

    component nh = Poseidon(1);
    nh.inputs[0] <== nullifier;
    nullifierHash <== nh.out;
}

// Verify `leaf` is in the tree with `root`, given the Merkle authentication path.
// pathIndices[i] = 0 -> current node is the LEFT child; 1 -> RIGHT child.
template MerkleTreeChecker(levels) {
    signal input leaf;
    signal input root;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    component hashers[levels];
    component mux[levels];
    signal levelHashes[levels + 1];
    levelHashes[0] <== leaf;

    for (var i = 0; i < levels; i++) {
        pathIndices[i] * (1 - pathIndices[i]) === 0; // boolean

        mux[i] = MultiMux1(2);
        mux[i].c[0][0] <== levelHashes[i];
        mux[i].c[0][1] <== pathElements[i];
        mux[i].c[1][0] <== pathElements[i];
        mux[i].c[1][1] <== levelHashes[i];
        mux[i].s <== pathIndices[i];

        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== mux[i].out[0];
        hashers[i].inputs[1] <== mux[i].out[1];
        levelHashes[i + 1] <== hashers[i].out;
    }

    root === levelHashes[levels];
}

template Withdraw(levels) {
    signal input root;          // public
    signal input nullifierHash; // public
    signal input extDataHash;   // public — binds recipient/relayer/fee out-of-circuit
    signal input nullifier;     // private
    signal input secret;        // private
    signal input pathElements[levels];  // private
    signal input pathIndices[levels];   // private

    component hasher = CommitmentHasher();
    hasher.nullifier <== nullifier;
    hasher.secret <== secret;
    hasher.nullifierHash === nullifierHash;

    component tree = MerkleTreeChecker(levels);
    tree.leaf <== hasher.commitment;
    tree.root <== root;
    for (var i = 0; i < levels; i++) {
        tree.pathElements[i] <== pathElements[i];
        tree.pathIndices[i] <== pathIndices[i];
    }

    // Constrain extDataHash into the proof (prevents the optimizer from dropping it,
    // so a relayer cannot alter the bound recipient/fee without a new proof).
    signal extDataSquare;
    extDataSquare <== extDataHash * extDataHash;
}

component main {public [root, nullifierHash, extDataHash]} = Withdraw(20);
