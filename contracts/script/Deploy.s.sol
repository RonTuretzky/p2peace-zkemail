// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Community} from "../src/Types.sol";
import {DKIMRegistry} from "../src/DKIMRegistry.sol";
import {ZKEmailVerifier} from "../src/ZKEmailVerifier.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {PeaceToken} from "../src/PeaceToken.sol";
import {Treasury} from "../src/Treasury.sol";
import {CommunityPool} from "../src/CommunityPool.sol";
import {PeaceMinter} from "../src/PeaceMinter.sol";
import {IncentiveRegistry} from "../src/IncentiveRegistry.sol";
import {EventAttestation} from "../src/EventAttestation.sol";
import {RedistributionEngine} from "../src/RedistributionEngine.sol";
import {SanctionsEscrow} from "../src/SanctionsEscrow.sol";
import {RealEmailVerifier} from "../src/RealEmailVerifier.sol";
import {ExitAssurance} from "../src/ExitAssurance.sol";
import {ExitReceiptVerifier} from "../src/ExitReceiptVerifier.sol";
import {MockUSD} from "../src/mocks/MockUSD.sol";
import {MockGroth16Verifier} from "../src/mocks/MockGroth16Verifier.sol";
import {IGroth16Verifier} from "../src/interfaces/IGroth16Verifier.sol";

/// @notice Full topology on a fresh chain. `admin` stands in for the timelocked
///         governance owner; `guardian` for the emergency pauser (the auto-expiring
///         pause is the emergency brake on settlement).
///
///         Env knobs:
///           RESERVE_TOKEN — address of an existing ERC20 to use as the reserve
///                           (e.g. sDAI on Gnosis, 0xaf204776c7245bF4147c2612BF6e5972Ee483701);
///                           unset → a MockUSD faucet token is deployed.
///           DEMO_SETUP    — true → register the real-world demo domains below,
///                           route both blueprints to the MockGroth16Verifier, and
///                           compress governance windows to 10 minutes.
///
///         Real Groth16 verifiers (see circuits/README.md) replace the mock without
///         touching anything else.
contract Deploy is Script {
    struct Deployment {
        IERC20 usd;
        DKIMRegistry dkim;
        ZKEmailVerifier verifier;
        MockGroth16Verifier groth16;
        IdentityRegistry identity;
        PeaceToken tokenA;
        PeaceToken tokenB;
        Treasury treasury;
        CommunityPool poolA;
        CommunityPool poolB;
        PeaceMinter minterA;
        PeaceMinter minterB;
        IncentiveRegistry incentives;
        EventAttestation attestation;
        RedistributionEngine engine;
        SanctionsEscrow escrow;
        ExitAssurance exitAssurance;
        ExitReceiptVerifier exitReceipt;
    }

    function run() external returns (Deployment memory d) {
        address admin = vm.envOr("ADMIN", msg.sender);
        address guardian = vm.envOr("GUARDIAN", msg.sender);
        address reserve = vm.envOr("RESERVE_TOKEN", address(0));
        vm.startBroadcast();
        d = deploy(admin, guardian, msg.sender, reserve);
        // DEMO_SETUP=true configures a walkable public demo: mock proofs accepted
        // for the configured domains, and short governance cycles so the full
        // propose → vote → attest → settle → claim loop completes in under an
        // hour. Requires ADMIN == the broadcasting key.
        if (vm.envOr("DEMO_SETUP", false)) demoSetup(d);
        vm.stopBroadcast();
    }

    /// @dev Test-friendly overload: fresh MockUSD reserve.
    function deploy(address admin, address guardian, address deployer)
        public
        returns (Deployment memory d)
    {
        return deploy(admin, guardian, deployer, address(0));
    }

    function deploy(address admin, address guardian, address deployer, address reserve)
        public
        returns (Deployment memory d)
    {
        // Ownable contracts are constructed with the deployer as interim owner so
        // this function can wire them, then handed to `admin`.
        d.usd = reserve == address(0) ? IERC20(address(new MockUSD())) : IERC20(reserve);
        d.dkim = new DKIMRegistry(deployer, guardian);
        d.verifier = new ZKEmailVerifier(deployer, d.dkim);
        d.groth16 = new MockGroth16Verifier();
        d.identity = new IdentityRegistry(deployer, d.verifier);

        d.tokenA = new PeaceToken("Peace Token A", "PEACE-A", Community.A, deployer);
        d.tokenB = new PeaceToken("Peace Token B", "PEACE-B", Community.B, deployer);
        d.treasury = new Treasury(deployer, d.usd);

        d.poolA = new CommunityPool(deployer, d.tokenA, Community.A, d.identity);
        d.poolB = new CommunityPool(deployer, d.tokenB, Community.B, d.identity);
        d.minterA =
            new PeaceMinter(deployer, d.usd, d.tokenA, d.poolA, d.identity, address(d.treasury));
        d.minterB =
            new PeaceMinter(deployer, d.usd, d.tokenB, d.poolB, d.identity, address(d.treasury));

        d.incentives = new IncentiveRegistry(
            deployer, d.identity, IERC20(address(d.tokenA)), IERC20(address(d.tokenB))
        );
        d.attestation = new EventAttestation(deployer, guardian, d.verifier, d.incentives);
        d.engine = new RedistributionEngine(
            deployer,
            guardian,
            d.usd,
            d.incentives,
            d.treasury,
            d.poolA,
            d.poolB,
            d.minterA,
            d.minterB
        );
        d.escrow = new SanctionsEscrow(d.usd, d.engine, d.minterA, d.minterB, address(d.treasury));

        // The Exit: voluntary migration of economic life out of the national currency
        // into sDAI-backed community money — the measurable demand-destruction path.
        d.exitReceipt = new ExitReceiptVerifier(deployer);
        d.exitAssurance = new ExitAssurance(deployer, d.usd, d.identity, d.verifier);

        // ---- wiring
        d.tokenA.setMinter(address(d.minterA));
        d.tokenB.setMinter(address(d.minterB));
        d.identity.setPools(d.poolA, d.poolB);
        d.poolA.wire(address(d.minterA), address(d.engine));
        d.poolB.wire(address(d.minterB), address(d.engine));
        d.minterA.setParMinter(address(d.engine), true);
        d.minterA.setParMinter(address(d.escrow), true);
        d.minterB.setParMinter(address(d.engine), true);
        d.minterB.setParMinter(address(d.escrow), true);
        d.incentives.wire(address(d.attestation));
        d.attestation.setEngine(d.engine);
        d.engine.wire(address(d.attestation));
        d.treasury.setSpender(address(d.engine), true);
        d.exitAssurance.setReceiptVerifier(d.exitReceipt);

        // ---- hand ownership to governance
        d.dkim.transferOwnership(admin);
        d.verifier.transferOwnership(admin);
        d.identity.transferOwnership(admin);
        d.tokenA.transferOwnership(admin);
        d.tokenB.transferOwnership(admin);
        d.treasury.transferOwnership(admin);
        d.poolA.transferOwnership(admin);
        d.poolB.transferOwnership(admin);
        d.minterA.transferOwnership(admin);
        d.minterB.transferOwnership(admin);
        d.incentives.transferOwnership(admin);
        d.attestation.transferOwnership(admin);
        d.engine.transferOwnership(admin);
        d.exitReceipt.transferOwnership(admin);
        d.exitAssurance.transferOwnership(admin);
    }

    // ---- demo fixtures (mirrored in app/lib/demo.ts) --------------------------
    //
    // Real-world domains for the live demo:
    //   community A gov:  btl.gov.il          (Israeli National Insurance Institute,
    //                                          sends from noreply@btl.gov.il)
    //   community B gov:  gov.ps              (Palestinian Authority portal)
    //   A-side press:     timesofisrael.com   (Times of Israel "Daily Edition" newsletter)
    //   B-side press:     wafa.ps             (WAFA — Palestine News Agency)
    //   international:    reuters.com, apnews.com  (both run daily email briefings)
    bytes32 internal constant CITIZENSHIP_PATTERN = keccak256("p2peace/citizenship-v1");
    bytes32 internal constant NEWS_PATTERN = keccak256("p2peace/news-event-v1:demo-keywords");

    function demoDomains() public pure returns (bytes32[6] memory) {
        return [
            keccak256("btl.gov.il"), //        [0] gov A
            keccak256("gov.ps"), //            [1] gov B
            keccak256("timesofisrael.com"), // [2] A-side press
            keccak256("wafa.ps"), //           [3] B-side press
            keccak256("reuters.com"), //       [4] international
            keccak256("apnews.com") //         [5] international
        ];
    }

    function demoSetup(Deployment memory d) public {
        bytes32[6] memory domains = demoDomains();
        for (uint256 i = 0; i < domains.length; i++) {
            d.dkim.setKey(domains[i], keccak256(abi.encode("dkim-key", domains[i])), 0, 0);
        }
        d.verifier.setVerifier(CITIZENSHIP_PATTERN, IGroth16Verifier(address(d.groth16)));
        d.verifier.setVerifier(NEWS_PATTERN, IGroth16Verifier(address(d.groth16)));
        d.identity.setCitizenshipPattern(CITIZENSHIP_PATTERN, true);
        d.identity.setDomain(domains[0], Community.A);
        d.identity.setDomain(domains[1], Community.B);
        d.incentives.setParams(10 minutes, 10 minutes, 3_000, 500);
        d.engine.setDisputeWindow(10 minutes);

        // Real-email path: if a real DKIM key is supplied via env, deploy the
        // on-chain RSA verifier, register the key, and map it to Community A so a
        // genuine btl.gov.il email (From: noreply@btl.gov.il) can enroll for real.
        if (vm.envOr("EMAIL_MODULUS", bytes("")).length > 0) {
            RealEmailVerifier rev = new RealEmailVerifier(msg.sender);
            bytes32 kid = rev.registerKey(
                vm.envString("EMAIL_DOMAIN"),
                vm.envString("EMAIL_SELECTOR"),
                vm.envBytes("EMAIL_MODULUS"),
                vm.envBytes("EMAIL_EXP")
            );
            d.identity.setRealVerifier(rev);
            d.identity.setRealKey(kid, Community.A, vm.envString("EMAIL_SENDER"));
        }

        // Exit-provenance path: if a ramp DKIM key is supplied, register it in the
        // ExitReceiptVerifier and allowlist its sender so members can attach a
        // conversion receipt to their exit. Env-gated so the mainnet deploy carries
        // no placeholder ramp key unless one is explicitly provided.
        if (vm.envOr("RAMP_MODULUS", bytes("")).length > 0) {
            bytes32 rkid = d.exitReceipt.registerKey(
                vm.envString("RAMP_DOMAIN"),
                vm.envString("RAMP_SELECTOR"),
                vm.envBytes("RAMP_MODULUS"),
                vm.envBytes("RAMP_EXP")
            );
            d.exitAssurance.setRampKey(rkid, vm.envString("RAMP_SENDER"));
        }
    }
}
