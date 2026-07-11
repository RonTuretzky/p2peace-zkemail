// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Community, EmailProof} from "./Types.sol";
import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";
import {IZKEmailVerifier} from "./interfaces/IZKEmailVerifier.sol";
import {ExitReceiptVerifier} from "./ExitReceiptVerifier.sol";

/// @notice The Exit — a member voluntarily moves economic life OUT of the national
///         currency and into money the two communities govern together (sDAI-backed).
///         This is the honest, measurable "currency-devaluation" mechanism: not a
///         price attack (you cannot sell a floating, deeply-reserved currency down —
///         see docs/CURRENCY-MECHANISM.md) but demand destruction, made concrete.
///
///         WHAT IS PROVEN, AND WHAT IS NOT.
///         * The load-bearing measure is a STOCK, not a flow: the sDAI held in this
///           contract right now. It is trustless (Gnosis consensus only), it shrinks
///           the instant anyone redeems, so it resists round-tripping by construction,
///           and it cannot be replayed. `exitIndex()` is that number.
///         * It is keyed by the citizenship nullifier, so one person's many wallets
///           aggregate into one position instead of inflating the count (Sybil cap).
///         * It does NOT prove the sDAI "came from" shekels. A member who already
///           held stablecoin looks identical to one who just exited. Provenance is a
///           SEPARATE, optional, best-effort attestation (a DKIM conversion receipt),
///           reported as its own number and never mixed into the stock.
///
///         THREE CAPABILITIES.
///         1. commit / redeem — lock sDAI as durable non-shekel custody (the stock).
///         2. assurance campaigns — a Kickstarter-style threshold ("I exit ₪X once the
///            community collectively commits ₪N"), the decentralized answer to the
///            collective-action problem that makes individual capital flight
///            macro-irrelevant. Funds are never trapped: a pledge is a commit that is
///            also tallied to a public goal, and can be withdrawn at any time.
///         3. attestProvenance — attach a DKIM-signed ramp receipt, bound to the
///            claimer's own address, as tamper-proof (but net-exit-silent) evidence
///            the stablecoin plausibly originated as shekels.
contract ExitAssurance is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable usd; // sDAI reserve, 18 decimals
    IIdentityRegistry public immutable identity;
    /// zkEmail verifier for the PRIVATE provenance path (mock now, circuit later).
    IZKEmailVerifier public immutable zkVerifier;

    /// Optional provenance verifier (the public DKIM receipt path). Zero = off.
    ExitReceiptVerifier public receiptVerifier;
    /// keyId → the exact ramp/exchange sender address a receipt's From must carry.
    mapping(bytes32 keyId => string) public rampSender;
    /// The exit-receipt blueprint (patternHash) accepted on the ZK path.
    bytes32 public exitPattern;
    /// domainHash (keccak of the ramp domain) allowlisted on the ZK path.
    mapping(bytes32 domainHash => bool) public rampDomainAllowed;
    /// The shielded exit pool — the only address allowed to credit anonymous exits.
    address public pool;

    // ---- exit positions, keyed by citizenship nullifier (one person = one position)
    mapping(bytes32 nullifier => uint256) public exited; //     total sDAI locked
    mapping(bytes32 nullifier => uint256) public sumPledged; // portion tied to campaigns
    uint256 public totalExited; //                             == usd.balanceOf(this)

    // ---- provenance (kept strictly separate from the stock accounting)
    mapping(bytes32 nullifier => bool) public provenanceAttested;
    mapping(bytes32 receiptNullifier => bool) public receiptUsed;
    uint256 public attestedExits; //     count of members with >=1 attached receipt
    uint256 public attestedIlsTotal; //  sum of ILS amounts asserted (presentational)

    // ---- assurance campaigns
    struct Campaign {
        address creator;
        Community community; // creator's community (None if cross-community)
        uint256 goal;
        uint64 deadline;
        uint256 total; // currently pledged (drops on unpledge; `reached` is sticky)
        bool reached;
        string uri;
    }

    Campaign[] public campaigns;
    /// campaignId → nullifier → amount currently pledged.
    mapping(uint256 campaignId => mapping(bytes32 nullifier => uint256)) public pledgedOf;

    event ReceiptVerifierSet(address verifier);
    event RampKeyMapped(bytes32 indexed keyId, string sender);
    event Committed(bytes32 indexed nullifier, address indexed wallet, uint256 amount);
    event Redeemed(bytes32 indexed nullifier, address indexed wallet, uint256 amount);
    event CampaignCreated(
        uint256 indexed campaignId, address indexed creator, uint256 goal, uint64 deadline
    );
    event Pledged(
        uint256 indexed campaignId, bytes32 indexed nullifier, address indexed wallet, uint256 amount
    );
    event Unpledged(
        uint256 indexed campaignId, bytes32 indexed nullifier, address indexed wallet, uint256 amount
    );
    event CampaignReached(uint256 indexed campaignId, uint256 total);
    event ProvenanceAttested(
        bytes32 indexed nullifier, address indexed wallet, uint256 ilsAmount, bytes32 receiptNullifier
    );
    event ProvenanceAttestedZK(
        bytes32 indexed nullifier, address indexed wallet, bytes32 receiptNullifier
    );
    event ExitPatternSet(bytes32 patternHash);
    event RampDomainSet(bytes32 indexed domainHash, bool allowed);
    event PoolSet(address pool);
    // Deliberately carries ONLY the anonymous pool nullifier — no wallet, ever.
    event ExitedFromPool(bytes32 indexed poolNullifier, uint256 amount);

    error NotMember();
    error ZeroAmount();
    error InsufficientPosition();
    error UnknownCampaign();
    error CampaignExpired();
    error ProvenanceDisabled();
    error RampNotMapped();
    error ReceiptAlreadyUsed();
    error PatternNotAllowed();
    error InvalidProof();
    error NotPool();

    constructor(address owner_, IERC20 usd_, IIdentityRegistry identity_, IZKEmailVerifier zk_)
        Ownable(owner_)
    {
        usd = usd_;
        identity = identity_;
        zkVerifier = zk_;
    }

    // ------------------------------------------------------------------- admin

    function setReceiptVerifier(ExitReceiptVerifier v) external onlyOwner {
        receiptVerifier = v;
        emit ReceiptVerifierSet(address(v));
    }

    /// @notice Allowlist a ramp/exchange DKIM key and the sender its receipts carry.
    function setRampKey(bytes32 keyId, string calldata sender) external onlyOwner {
        rampSender[keyId] = sender;
        emit RampKeyMapped(keyId, sender);
    }

    /// @notice Set the exit-receipt blueprint accepted on the private (ZK) path.
    function setExitPattern(bytes32 patternHash) external onlyOwner {
        exitPattern = patternHash;
        emit ExitPatternSet(patternHash);
    }

    /// @notice Allowlist a ramp domain (keccak of the domain) for the ZK path.
    function setRampDomain(bytes32 domainHash, bool allowed) external onlyOwner {
        rampDomainAllowed[domainHash] = allowed;
        emit RampDomainSet(domainHash, allowed);
    }

    /// @notice Set the shielded exit pool (the only caller of commitFromPool).
    function setPool(address pool_) external onlyOwner {
        pool = pool_;
        emit PoolSet(pool_);
    }

    // --------------------------------------------------------- commit / redeem

    /// @notice Lock `amount` sDAI as an exit position. Requires active membership; the
    ///         position is keyed by your citizenship nullifier, so it follows you
    ///         across wallet rotations and cannot be split for Sybil gain.
    function commit(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        bytes32 nf = _memberNullifier(msg.sender);
        usd.safeTransferFrom(msg.sender, address(this), amount);
        exited[nf] += amount;
        totalExited += amount;
        emit Committed(nf, msg.sender, amount);
    }

    /// @notice Withdraw `amount` of your *unpledged* exit position back to your wallet.
    ///         Redeeming shrinks the Exit Index — the metric is honest about round-trips.
    function redeem(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        bytes32 nf = _ownerNullifier(msg.sender);
        uint256 free = exited[nf] - sumPledged[nf];
        if (amount > free) revert InsufficientPosition();
        exited[nf] -= amount;
        totalExited -= amount;
        usd.safeTransfer(msg.sender, amount);
        emit Redeemed(nf, msg.sender, amount);
    }

    /// @notice Credit an exit position keyed by an ANONYMOUS pool nullifier — the
    ///         shielded-pool sink. Unlike commit(), it does NOT call _memberNullifier,
    ///         so the crediting party never has to be a registered (KYC-adjacent)
    ///         member: this is the whole point — the anonymous withdrawal from the
    ///         shielded pool credits the Exit Index without any wallet or identity on
    ///         a p2p2p-branded contract. The pool transfers the funds in first, so the
    ///         totalExited == balanceOf invariant holds. One-way for v1 (redeeming a
    ///         pool position back out anonymously needs a withdraw-side ZK proof — v2).
    function commitFromPool(bytes32 poolNullifier, uint256 amount) external {
        if (msg.sender != pool) revert NotPool();
        if (amount == 0) revert ZeroAmount();
        exited[poolNullifier] += amount;
        totalExited += amount;
        emit ExitedFromPool(poolNullifier, amount);
    }

    // ------------------------------------------------------- assurance campaigns

    /// @notice Open a threshold campaign: "we collectively commit to exiting ₪`goal`."
    ///         Permissionless among members — coordination is grassroots.
    function createCampaign(uint256 goal, uint64 deadline, string calldata uri)
        external
        returns (uint256 id)
    {
        if (goal == 0) revert ZeroAmount();
        _memberNullifier(msg.sender); // members only
        id = campaigns.length;
        campaigns.push(
            Campaign({
                creator: msg.sender,
                community: identity.communityOf(msg.sender),
                goal: goal,
                deadline: deadline,
                total: 0,
                reached: false,
                uri: uri
            })
        );
        emit CampaignCreated(id, msg.sender, goal, deadline);
    }

    /// @notice Commit sDAI AND tally it to a campaign's public goal. A pledge is an
    ///         exit position like any other (counts in the Exit Index immediately) —
    ///         the threshold only coordinates the collective declaration.
    function pledge(uint256 campaignId, uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        Campaign storage c = _campaign(campaignId);
        if (c.deadline != 0 && block.timestamp > c.deadline) revert CampaignExpired();
        bytes32 nf = _memberNullifier(msg.sender);

        usd.safeTransferFrom(msg.sender, address(this), amount);
        exited[nf] += amount;
        sumPledged[nf] += amount;
        pledgedOf[campaignId][nf] += amount;
        c.total += amount;
        totalExited += amount;
        emit Pledged(campaignId, nf, msg.sender, amount);

        if (!c.reached && c.total >= c.goal) {
            c.reached = true;
            emit CampaignReached(campaignId, c.total);
        }
    }

    /// @notice Withdraw part of your pledge (funds are never trapped). `reached` stays
    ///         true if the goal was ever met — it records that it happened.
    function unpledge(uint256 campaignId, uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        _campaign(campaignId); // existence
        bytes32 nf = _ownerNullifier(msg.sender);
        if (amount > pledgedOf[campaignId][nf]) revert InsufficientPosition();

        pledgedOf[campaignId][nf] -= amount;
        sumPledged[nf] -= amount;
        exited[nf] -= amount;
        campaigns[campaignId].total -= amount;
        totalExited -= amount;
        usd.safeTransfer(msg.sender, amount);
        emit Unpledged(campaignId, nf, msg.sender, amount);
    }

    /// @notice Anyone can mark a campaign reached once its live total meets the goal.
    function markReached(uint256 campaignId) external {
        Campaign storage c = _campaign(campaignId);
        if (!c.reached && c.total >= c.goal) {
            c.reached = true;
            emit CampaignReached(campaignId, c.total);
        }
    }

    // -------------------------------------------------------------- provenance

    /// @notice Attach a DKIM-signed ramp conversion receipt to your exit as
    ///         tamper-proof (but net-exit-silent) shekel provenance. The receipt must
    ///         name your own wallet as its destination address (bound in the verifier),
    ///         so it is not a bearer instrument. One physical receipt counts once.
    function attestProvenance(
        bytes32 keyId,
        bytes calldata signedHeaders,
        bytes calldata signature,
        bytes calldata body
    ) external {
        ExitReceiptVerifier v = receiptVerifier;
        if (address(v) == address(0)) revert ProvenanceDisabled();
        string memory sender = rampSender[keyId];
        if (bytes(sender).length == 0) revert RampNotMapped();
        bytes32 nf = _memberNullifier(msg.sender);

        (bytes32 receiptNullifier, uint256 ilsAmount) =
            v.verifyReceipt(keyId, signedHeaders, signature, body, sender, msg.sender);
        if (receiptUsed[receiptNullifier]) revert ReceiptAlreadyUsed();
        receiptUsed[receiptNullifier] = true;

        if (!provenanceAttested[nf]) {
            provenanceAttested[nf] = true;
            attestedExits += 1;
        }
        attestedIlsTotal += ilsAmount;
        emit ProvenanceAttested(nf, msg.sender, ilsAmount, receiptNullifier);
    }

    /// @notice PRIVATE provenance: prove — in zero knowledge — that you hold a
    ///         DKIM-signed ramp withdrawal receipt naming your own address, WITHOUT
    ///         putting the address or the email on-chain. Only the proof's nullifier
    ///         is revealed. The proof is bound to msg.sender (extraData), so it is not
    ///         a bearer instrument; the nullifier (derived in-circuit from the DKIM
    ///         signature folded with a wallet secret) dedups replay and cannot be
    ///         recomputed by the exchange. Mock verifier today; a compiled zkEmail
    ///         circuit drops into the same `exitPattern` slot with no contract change.
    function attestProvenanceZK(EmailProof calldata p) external {
        bytes32 nf = _memberNullifier(msg.sender);
        if (exitPattern == bytes32(0) || p.patternHash != exitPattern) revert PatternNotAllowed();
        if (!rampDomainAllowed[p.domainHash]) revert RampNotMapped();
        // Bind the proof to this wallet — a stolen proof can't be redirected.
        if (!zkVerifier.verify(p, uint256(uint160(msg.sender)))) revert InvalidProof();
        if (receiptUsed[p.nullifier]) revert ReceiptAlreadyUsed();
        receiptUsed[p.nullifier] = true;

        if (!provenanceAttested[nf]) {
            provenanceAttested[nf] = true;
            attestedExits += 1;
        }
        emit ProvenanceAttestedZK(nf, msg.sender, p.nullifier);
    }

    // ------------------------------------------------------------------ views

    /// @notice The honest, trustless headline: total sDAI held here right now —
    ///         value denominated outside the national currency, that shrinks on exit.
    function exitIndex() external view returns (uint256) {
        return totalExited;
    }

    /// @notice A member's total exit position (general + pledged), by wallet.
    function positionOf(address wallet) external view returns (uint256) {
        return exited[identity.nullifierOf(wallet)];
    }

    /// @notice A member's free (redeemable, unpledged) position, by wallet.
    function freePositionOf(address wallet) external view returns (uint256) {
        bytes32 nf = identity.nullifierOf(wallet);
        return exited[nf] - sumPledged[nf];
    }

    function campaignCount() external view returns (uint256) {
        return campaigns.length;
    }

    function getCampaign(uint256 campaignId)
        external
        view
        returns (
            address creator,
            Community community,
            uint256 goal,
            uint64 deadline,
            uint256 total,
            bool reached,
            string memory uri
        )
    {
        Campaign storage c = _campaign(campaignId);
        return (c.creator, c.community, c.goal, c.deadline, c.total, c.reached, c.uri);
    }

    // ------------------------------------------------------------------ internal

    /// @dev Active-membership gate for inflows. Returns the citizenship nullifier.
    function _memberNullifier(address wallet) internal view returns (bytes32) {
        if (!identity.isActiveMember(wallet)) revert NotMember();
        return identity.nullifierOf(wallet);
    }

    /// @dev Ownership gate for outflows: the wallet must currently hold the nullifier
    ///      of the position (funds follow rotation; lapsed members can still redeem).
    function _ownerNullifier(address wallet) internal view returns (bytes32 nf) {
        nf = identity.nullifierOf(wallet);
        if (nf == bytes32(0)) revert NotMember();
    }

    function _campaign(uint256 campaignId) internal view returns (Campaign storage) {
        if (campaignId >= campaigns.length) revert UnknownCampaign();
        return campaigns[campaignId];
    }
}
