// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IGroth16Verifier} from "../interfaces/IGroth16Verifier.sol";
import {WithdrawGroth16Verifier} from "./WithdrawGroth16Verifier.sol";

/// @notice Adapts the snarkjs-generated Groth16 verifier —
///         `verifyProof(uint[2] a, uint[2][2] b, uint[2] c, uint[3] pub)` — to the
///         repo's `IGroth16Verifier.verifyProof(uint256[8] proof, uint256[6] input)`
///         so it drops into the pool's `withdrawVerifier` slot unchanged.
///
///         proof[8] = [a0,a1, b00,b01,b10,b11, c0,c1] (snarkjs exportSolidityCallData
///         order). The withdraw circuit has 3 public signals:
///         input[0]=root, input[1]=nullifierHash, input[2]=extDataHash.
contract WithdrawVerifierAdapter is IGroth16Verifier {
    WithdrawGroth16Verifier public immutable verifier;

    constructor(WithdrawGroth16Verifier verifier_) {
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
            [input[0], input[1], input[2]]
        );
    }
}
