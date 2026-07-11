// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EmailProof} from "./Types.sol";
import {IZKEmailVerifier} from "./interfaces/IZKEmailVerifier.sol";
import {IGroth16Verifier} from "./interfaces/IGroth16Verifier.sol";
import {ExitAssurance} from "./ExitAssurance.sol";
import {MerkleTreeWithHistory} from "./lib/MerkleTreeWithHistory.sol";

/// @notice A fixed-denomination shielded pool whose anonymity set is exactly the set
///         of DKIM-verified real Bit2C exits (Vitalik's Privacy-Pools association-set
///         idea, inverted: entry is gated by a *proof of real provenance* rather than
///         a compliance blocklist). It severs the on-chain link between a citizen's
///         KYC/gov-linked Bit2C settlement wallet and their participation in p2p2p.
///
///         FLOW (see docs/CURRENCY-MECHANISM.md §5.5):
///           1. mintVoucher(EmailProof) — a Bit2C provenance proof (bound to NOTHING
///              but its own exit-nullifier, so it does not expose the depositing wallet)
///              mints a single-use right to deposit one denomination.
///           2. deposit(exitNullifier, commitment) — consumes the voucher, pulls exactly
///              `denomination`, and appends the commitment leaf. PUBLIC: a depositor, a
///              denomination, a time. This is a generic "verified-exit pool" deposit —
///              intentionally NOT p2p2p-branded, so the deposit itself is not the tell.
///           3. withdraw(proof, root, nullifier, extData) — a relayer submits a ZK proof
///              that some commitment in the tree is being spent; only a fresh pool
///              nullifier is revealed, and the value is credited into ExitAssurance via
///              commitFromPool. NO on-chain edge connects the deposit to this withdrawal.
///
///         HONEST TIER. The structure below is REAL: incremental Merkle tree, nullifier
///         double-spend prevention, single-use vouchers, fixed denomination, relayer
///         fee bound via extDataHash so the relayer is untrusted, and an anonymous
///         (member-less) sink. Real ANONYMITY additionally requires the withdraw proof
///         to be a COMPILED Merkle-membership circuit: with the MockGroth16Verifier the
///         withdraw does not actually hide which deposit it drains. That one circuit is
///         the line between "demonstrates the model" and "provides anonymity"; it drops
///         into `withdrawVerifier` with no other change.
contract ProvenanceShieldedPool is MerkleTreeWithHistory, Ownable {
    using SafeERC20 for IERC20;

    // BN254 scalar field — extDataHash is reduced into it for SNARK compatibility.
    uint256 internal constant FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;

    IERC20 public immutable reserve;
    ExitAssurance public immutable exitAssurance;
    IZKEmailVerifier public immutable zkEmailVerifier;
    IGroth16Verifier public immutable withdrawVerifier;
    uint256 public immutable denomination;
    bytes32 public immutable exitPattern; // provenance blueprint (patternHash)

    mapping(bytes32 domainHash => bool) public rampDomainAllowed;
    uint256 public minDeposits; // k-anonymity floor before any withdrawal is allowed

    mapping(bytes32 exitNullifier => bool) public voucher; // minted, unspent
    mapping(bytes32 exitNullifier => bool) public voucherSpent;
    mapping(bytes32 poolNullifier => bool) public nullifierSpent;
    mapping(bytes32 commitment => bool) public commitments;
    uint256 public depositCount;

    /// Bound into the withdraw proof so a relayer cannot re-target the fee.
    struct ExtData {
        address relayer;
        uint256 fee;
    }

    event RampDomainSet(bytes32 indexed domainHash, bool allowed);
    event MinDepositsSet(uint256 minDeposits);
    event VoucherMinted(bytes32 indexed exitNullifier, uint256 denomination);
    event DepositInserted(uint32 indexed leafIndex, bytes32 indexed commitment);
    // Carries ONLY the anonymous pool nullifier + relayer — never a depositor wallet.
    event Withdrawn(bytes32 indexed poolNullifier, address indexed relayer, uint256 fee);

    error PatternNotAllowed();
    error RampNotAllowed();
    error InvalidProof();
    error VoucherUnknown();
    error VoucherUsed();
    error CommitmentExists();
    error UnknownRoot();
    error NullifierUsed();
    error TooFewDeposits();
    error FeeTooHigh();

    constructor(
        IERC20 reserve_,
        ExitAssurance exitAssurance_,
        IZKEmailVerifier zkEmailVerifier_,
        IGroth16Verifier withdrawVerifier_,
        uint256 denomination_,
        bytes32 exitPattern_,
        uint256 minDeposits_,
        uint32 levels_,
        address owner_
    ) MerkleTreeWithHistory(levels_) Ownable(owner_) {
        reserve = reserve_;
        exitAssurance = exitAssurance_;
        zkEmailVerifier = zkEmailVerifier_;
        withdrawVerifier = withdrawVerifier_;
        denomination = denomination_;
        exitPattern = exitPattern_;
        minDeposits = minDeposits_;
    }

    function setRampDomain(bytes32 domainHash, bool allowed) external onlyOwner {
        rampDomainAllowed[domainHash] = allowed;
        emit RampDomainSet(domainHash, allowed);
    }

    function setMinDeposits(uint256 minDeposits_) external onlyOwner {
        minDeposits = minDeposits_;
        emit MinDepositsSet(minDeposits_);
    }

    /// @notice STEP 1 — mint a single-use deposit voucher from a Bit2C provenance proof.
    ///         extraData is 0: the provenance proof binds to its own exit-nullifier, NOT
    ///         to msg.sender, so the wallet that mints (and later the wallet that
    ///         deposits) is never exposed by the proof.
    function mintVoucher(EmailProof calldata p) external {
        if (p.patternHash != exitPattern) revert PatternNotAllowed();
        if (!rampDomainAllowed[p.domainHash]) revert RampNotAllowed();
        if (voucher[p.nullifier] || voucherSpent[p.nullifier]) revert VoucherUsed();
        if (!zkEmailVerifier.verify(p, 0)) revert InvalidProof();
        voucher[p.nullifier] = true;
        emit VoucherMinted(p.nullifier, denomination);
    }

    /// @notice STEP 2 — deposit exactly one denomination behind a fresh commitment,
    ///         consuming a provenance voucher. The commitment hides the secret and the
    ///         future spend nullifier.
    function deposit(bytes32 exitNullifier, bytes32 commitment) external {
        if (!voucher[exitNullifier]) revert VoucherUnknown();
        if (commitments[commitment]) revert CommitmentExists();
        voucher[exitNullifier] = false;
        voucherSpent[exitNullifier] = true;
        commitments[commitment] = true;

        reserve.safeTransferFrom(msg.sender, address(this), denomination);
        uint32 idx = _insert(commitment);
        depositCount += 1;
        emit DepositInserted(idx, commitment);
    }

    /// @notice STEP 4 — anonymous withdrawal, relayer-submitted. Proves (in ZK) that a
    ///         commitment in the tree is being spent, reveals a fresh pool nullifier,
    ///         pays the relayer its bound fee, and credits the remainder into
    ///         ExitAssurance keyed by the nullifier — no wallet, no membership, no link.
    function withdraw(
        uint256[8] calldata proof,
        bytes32 root,
        bytes32 poolNullifier,
        ExtData calldata ext
    ) external {
        if (depositCount < minDeposits) revert TooFewDeposits();
        if (!isKnownRoot(root)) revert UnknownRoot();
        if (nullifierSpent[poolNullifier]) revert NullifierUsed();
        if (ext.fee > denomination) revert FeeTooHigh();

        // Bind relayer + fee into the proof: a relayer cannot inflate the fee or
        // re-target the payout without invalidating the proof.
        uint256 extDataHash = uint256(keccak256(abi.encode(ext))) % FIELD;
        bool ok = withdrawVerifier.verifyProof(
            proof, [uint256(root), uint256(poolNullifier), extDataHash, 0, 0, 0]
        );
        if (!ok) revert InvalidProof();
        nullifierSpent[poolNullifier] = true;

        uint256 toExit = denomination - ext.fee;
        if (ext.fee > 0) reserve.safeTransfer(ext.relayer, ext.fee);
        reserve.safeTransfer(address(exitAssurance), toExit);
        exitAssurance.commitFromPool(poolNullifier, toExit);
        emit Withdrawn(poolNullifier, ext.relayer, ext.fee);
    }
}
