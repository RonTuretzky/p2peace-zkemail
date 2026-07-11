// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {DKIMRegistry} from "../src/DKIMRegistry.sol";
import {ZKEmailVerifier} from "../src/ZKEmailVerifier.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {ExitAssurance} from "../src/ExitAssurance.sol";
import {ProvenanceShieldedPool} from "../src/ProvenanceShieldedPool.sol";
import {MockUSD} from "../src/mocks/MockUSD.sol";
import {MockGroth16Verifier} from "../src/mocks/MockGroth16Verifier.sol";
import {IGroth16Verifier} from "../src/interfaces/IGroth16Verifier.sol";

/// @notice Deploys the shielded-exit slice to Sepolia (stand-in for Ethereum mainnet,
///         where Bit2C settles — so NO bridge). Reserve is MockUSD (no sDAI on Sepolia).
///         Both ZK verifiers are mocks: the pool STRUCTURE is real (tree, nullifiers,
///         vouchers, fixed denomination, relayer-fee binding, anonymous sink), but real
///         anonymity needs the compiled withdraw circuit dropped into `withdrawVerifier`.
contract DeployShieldedExit is Script {
    bytes32 internal constant EXIT_PATTERN = keccak256("p2peace/exit-receipt-v1");
    bytes32 internal constant BIT2C = keccak256("bit2c.co.il");
    bytes32 internal constant BIT2C_KEYHASH = keccak256("p2peace/bit2c-s1-keyhash");
    uint256 internal constant DENOM = 1000e18;

    // state vars (script is ephemeral) — keeps run() out of stack-too-deep
    MockUSD internal usd;
    DKIMRegistry internal dkim;
    ZKEmailVerifier internal zk;
    MockGroth16Verifier internal provMock;
    MockGroth16Verifier internal withdrawMock;
    IdentityRegistry internal identity;
    ExitAssurance internal ea;
    ProvenanceShieldedPool internal pool;

    function run() external {
        vm.startBroadcast();
        address me = msg.sender;
        usd = new MockUSD();
        dkim = new DKIMRegistry(me, me);
        zk = new ZKEmailVerifier(me, dkim);
        provMock = new MockGroth16Verifier();
        withdrawMock = new MockGroth16Verifier();
        identity = new IdentityRegistry(me, zk);
        ea = new ExitAssurance(me, IERC20(address(usd)), identity, zk);
        pool = new ProvenanceShieldedPool(
            IERC20(address(usd)), ea, zk, IGroth16Verifier(address(withdrawMock)),
            DENOM, EXIT_PATTERN, 1, 20, me
        );
        zk.setVerifier(EXIT_PATTERN, IGroth16Verifier(address(provMock)));
        dkim.setKey(BIT2C, BIT2C_KEYHASH, 0, 0);
        ea.setPool(address(pool));
        pool.setRampDomain(BIT2C, true);
        vm.stopBroadcast();
        _log();
    }

    function _log() internal view {
        console2.log("MockUSD:", address(usd));
        console2.log("ExitAssurance:", address(ea));
        console2.log("ShieldedPool:", address(pool));
        console2.log("ZKEmailVerifier:", address(zk));
        console2.log("provenanceMock:", address(provMock));
        console2.log("withdrawMock:", address(withdrawMock));
        console2.log("DKIMRegistry:", address(dkim));
        console2.log("IdentityRegistry:", address(identity));
    }
}
