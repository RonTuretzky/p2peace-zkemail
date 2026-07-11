// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IIdentityRegistry} from "../src/interfaces/IIdentityRegistry.sol";
import {IZKEmailVerifier} from "../src/interfaces/IZKEmailVerifier.sol";
import {ExitAssurance} from "../src/ExitAssurance.sol";
import {ExitReceiptVerifier} from "../src/ExitReceiptVerifier.sol";

/// @notice Standalone, ADDITIVE deploy of the Exit mechanism against an EXISTING
///         system — it reuses the live IdentityRegistry (for the citizenship
///         nullifier / Sybil cap) and the live sDAI reserve, so it can be added to the
///         running Gnosis deployment without redeploying (and re-addressing) anything.
///
///         Env:
///           RESERVE_TOKEN — sDAI (0xaf204776c7245bF4147c2612BF6e5972Ee483701)
///           IDENTITY      — the live IdentityRegistry address
///           ADMIN         — governance owner to hand the two contracts to (default: sender)
///           RAMP_*        — optional ramp DKIM key to register for the provenance path
contract DeployExit is Script {
    function run() external returns (ExitAssurance ea, ExitReceiptVerifier erv) {
        address admin = vm.envOr("ADMIN", msg.sender);
        address reserve = vm.envAddress("RESERVE_TOKEN");
        address identity = vm.envAddress("IDENTITY");
        address zk = vm.envAddress("ZK_VERIFIER");

        vm.startBroadcast();
        erv = new ExitReceiptVerifier(msg.sender);
        ea = new ExitAssurance(
            msg.sender, IERC20(reserve), IIdentityRegistry(identity), IZKEmailVerifier(zk)
        );
        ea.setReceiptVerifier(erv);

        if (vm.envOr("RAMP_MODULUS", bytes("")).length > 0) {
            bytes32 rkid = erv.registerKey(
                vm.envString("RAMP_DOMAIN"),
                vm.envString("RAMP_SELECTOR"),
                vm.envBytes("RAMP_MODULUS"),
                vm.envBytes("RAMP_EXP")
            );
            ea.setRampKey(rkid, vm.envString("RAMP_SENDER"));
        }

        erv.transferOwnership(admin);
        ea.transferOwnership(admin);
        vm.stopBroadcast();

        console2.log("ExitReceiptVerifier:", address(erv));
        console2.log("ExitAssurance:", address(ea));
    }
}
