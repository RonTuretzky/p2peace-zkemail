// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {DKIMRegistry} from "../src/DKIMRegistry.sol";
import {ZKEmailVerifier} from "../src/ZKEmailVerifier.sol";
import {IdentityRegistry} from "../src/IdentityRegistry.sol";
import {ExitAssurance} from "../src/ExitAssurance.sol";
import {ProvenanceShieldedPool} from "../src/ProvenanceShieldedPool.sol";
import {IHasher} from "../src/lib/MerkleTreeWithHistory.sol";
import {MockUSD} from "../src/mocks/MockUSD.sol";
import {MockGroth16Verifier} from "../src/mocks/MockGroth16Verifier.sol";
import {IGroth16Verifier} from "../src/interfaces/IGroth16Verifier.sol";
import {WithdrawGroth16Verifier} from "../src/verifiers/WithdrawGroth16Verifier.sol";
import {WithdrawVerifierAdapter} from "../src/verifiers/WithdrawVerifierAdapter.sol";

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
    WithdrawGroth16Verifier internal g16;
    WithdrawVerifierAdapter internal adapter;
    IdentityRegistry internal identity;
    ExitAssurance internal ea;
    ProvenanceShieldedPool internal pool;

    /// The Poseidon(2) hasher is deployed separately from its circomlib EVM bytecode
    /// (zk/build/poseidon2_bytecode.txt) and passed in via env — Solidity can't embed it.
    function run() external {
        address hasher = vm.envAddress("HASHER");
        vm.startBroadcast();
        address me = msg.sender;
        usd = new MockUSD();
        dkim = new DKIMRegistry(me, me);
        zk = new ZKEmailVerifier(me, dkim);
        provMock = new MockGroth16Verifier();
        g16 = new WithdrawGroth16Verifier();
        adapter = new WithdrawVerifierAdapter(g16);
        identity = new IdentityRegistry(me, zk);
        ea = new ExitAssurance(me, IERC20(address(usd)), identity, zk);
        pool = new ProvenanceShieldedPool(
            IERC20(address(usd)), ea, zk, IGroth16Verifier(address(adapter)), IHasher(hasher),
            DENOM, EXIT_PATTERN, 1, 20, me
        );
        zk.setVerifier(EXIT_PATTERN, IGroth16Verifier(address(provMock)));
        dkim.setKey(BIT2C, BIT2C_KEYHASH, 0, 0);
        ea.setPool(address(pool));
        pool.setRampDomain(BIT2C, true);
        vm.stopBroadcast();
        _log(hasher);
    }

    function _log(address hasher) internal view {
        console2.log("MockUSD:", address(usd));
        console2.log("ExitAssurance:", address(ea));
        console2.log("ShieldedPool:", address(pool));
        console2.log("ZKEmailVerifier:", address(zk));
        console2.log("provenanceMock:", address(provMock));
        console2.log("WithdrawGroth16Verifier:", address(g16));
        console2.log("WithdrawVerifierAdapter:", address(adapter));
        console2.log("PoseidonHasher:", hasher);
        console2.log("DKIMRegistry:", address(dkim));
        console2.log("IdentityRegistry:", address(identity));
    }
}
