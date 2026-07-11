// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IGroth16Verifier} from "../interfaces/IGroth16Verifier.sol";
import {ProvenanceGroth16Verifier} from "./ProvenanceGroth16Verifier.sol";

/// @notice Adapts the snarkjs-generated zkEmail provenance verifier to the repo's
///         `IGroth16Verifier` so it drops into `ZKEmailVerifier`'s per-blueprint slot,
///         replacing the mock. `ZKEmailVerifier` passes public inputs in the layout
///         [pubkeyHash, domainHash, nullifier, patternHash, emailTimestamp, extraData];
///         the compiled circuit emits its signals as OUTPUTS then PUBLIC INPUTS, i.e.
///         [pubkeyHash, nullifier, domainHash, patternHash, emailTimestamp, extraData].
///         The only difference is domainHash <-> nullifier order, which this reorders.
///         proof[8] = [a0,a1, b00,b01,b10,b11, c0,c1] (snarkjs calldata order).
contract ProvenanceVerifierAdapter is IGroth16Verifier {
    ProvenanceGroth16Verifier public immutable verifier;

    constructor(ProvenanceGroth16Verifier verifier_) {
        verifier = verifier_;
    }

    function verifyProof(uint256[8] calldata proof, uint256[6] calldata input)
        external
        view
        returns (bool)
    {
        return verifier.verifyProof(
            [proof[0], proof[1]],
            [[proof[2], proof[3]], [proof[4], proof[5]]],
            [proof[6], proof[7]],
            // reorder: [pubkeyHash, nullifier, domainHash, patternHash, ts, extraData]
            [input[0], input[2], input[1], input[3], input[4], input[5]]
        );
    }
}
