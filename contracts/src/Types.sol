// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice The two enrolled communities. None doubles as "not a member".
enum Community {
    None,
    A,
    B
}

/// @notice Source categories for news-event attestation (mirrors the original
///         proposal's "Israeli / Palestinian / International" source buckets).
enum SourceCategory {
    None,
    CommunityA,
    CommunityB,
    International
}

/// @notice What a confirmed event does with value.
///         Harmful*: slash the responsible community's pool corpus into the other
///         community's rewards. Positive*/Joint: pay rewards from the Treasury.
enum Direction {
    HarmfulByA,
    HarmfulByB,
    PositiveForA,
    PositiveForB,
    Joint
}

/// @notice Uniform zkEmail proof envelope. Public signals of every p2peace
///         blueprint, in circuit order, plus the Groth16 proof points.
///         The sixth public input (extraData) is supplied by the caller context:
///         the target wallet for identity proofs, 0 for event attestations.
struct EmailProof {
    bytes32 dkimPubkeyHash; // Poseidon hash of the DKIM RSA key that signed the email
    bytes32 domainHash; //     keccak256(lowercase sender domain)
    bytes32 nullifier; //      per-address (identity) or per-email (events)
    bytes32 patternHash; //    keccak256(blueprintId ‖ version) — pins the exact circuit
    uint64 emailTimestamp; //  DKIM-covered Date header, unix seconds
    uint256[8] proof; //       Groth16 πA(2) ‖ πB(4) ‖ πC(2)
}
