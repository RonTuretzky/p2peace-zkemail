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
import {DisputeCouncil} from "../src/DisputeCouncil.sol";
import {SanctionsEscrow} from "../src/SanctionsEscrow.sol";
import {BusinessRegistry} from "../src/BusinessRegistry.sol";
import {MockUSD} from "../src/mocks/MockUSD.sol";
import {MockGroth16Verifier} from "../src/mocks/MockGroth16Verifier.sol";
import {IGroth16Verifier} from "../src/interfaces/IGroth16Verifier.sol";

/// @notice Full demo topology on a fresh chain. `admin` stands in for the timelocked
///         governance owner; `guardian` for the emergency pauser. Real deployments
///         replace the MockGroth16Verifier with per-blueprint compiled verifiers
///         (see circuits/README.md) — nothing else changes.
contract Deploy is Script {
    struct Deployment {
        MockUSD usd;
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
        DisputeCouncil council;
        SanctionsEscrow escrow;
        BusinessRegistry business;
    }

    function run() external returns (Deployment memory d) {
        address admin = vm.envOr("ADMIN", msg.sender);
        address guardian = vm.envOr("GUARDIAN", msg.sender);
        vm.startBroadcast();
        d = deploy(admin, guardian, msg.sender);
        vm.stopBroadcast();
    }

    /// @dev Also called from tests so the wiring is exercised end to end.
    function deploy(address admin, address guardian, address deployer)
        public
        returns (Deployment memory d)
    {
        // Ownable contracts are constructed with the deployer as interim owner so
        // this function can wire them, then handed to `admin`.
        d.usd = new MockUSD();
        d.dkim = new DKIMRegistry(deployer, guardian);
        d.verifier = new ZKEmailVerifier(deployer, d.dkim);
        d.groth16 = new MockGroth16Verifier();
        d.identity = new IdentityRegistry(deployer, d.verifier);

        d.tokenA = new PeaceToken("Peace Token A", "PEACE-A", Community.A, deployer);
        d.tokenB = new PeaceToken("Peace Token B", "PEACE-B", Community.B, deployer);
        d.treasury = new Treasury(deployer, IERC20(address(d.usd)));

        d.poolA = new CommunityPool(deployer, d.tokenA, Community.A, d.identity);
        d.poolB = new CommunityPool(deployer, d.tokenB, Community.B, d.identity);
        d.minterA = new PeaceMinter(
            deployer, IERC20(address(d.usd)), d.tokenA, d.poolA, d.identity, address(d.treasury)
        );
        d.minterB = new PeaceMinter(
            deployer, IERC20(address(d.usd)), d.tokenB, d.poolB, d.identity, address(d.treasury)
        );

        d.incentives = new IncentiveRegistry(
            deployer, d.identity, IERC20(address(d.tokenA)), IERC20(address(d.tokenB))
        );
        d.attestation = new EventAttestation(deployer, guardian, d.verifier, d.incentives);
        d.engine = new RedistributionEngine(
            deployer,
            guardian,
            IERC20(address(d.usd)),
            d.incentives,
            d.treasury,
            d.poolA,
            d.poolB,
            d.minterA,
            d.minterB
        );
        d.council = new DisputeCouncil(admin, d.engine);
        d.escrow =
            new SanctionsEscrow(IERC20(address(d.usd)), d.engine, d.minterA, d.minterB, address(d.treasury));
        d.business = new BusinessRegistry(
            admin, d.identity, d.treasury, IERC20(address(d.tokenA)), IERC20(address(d.tokenB))
        );

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
        d.incentives.wire(address(d.attestation), address(d.engine));
        d.attestation.setEngine(d.engine);
        d.engine.wire(address(d.attestation), address(d.council));
        d.treasury.setSpender(address(d.engine), true);
        d.treasury.setSpender(address(d.business), true);

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
    }
}
