// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {RealEmailVerifier} from "../src/RealEmailVerifier.sol";

/// @notice Deploys the standalone real-email DKIM verifier and registers the live
///         Amazon SES key that signs btl.gov.il mail. `EMAIL_MODULUS` / `EMAIL_EXP`
///         are passed as hex via env so the (public) key material stays out of source.
contract DeployRealVerifier is Script {
    function run() external {
        bytes memory modulus = vm.envBytes("EMAIL_MODULUS");
        bytes memory exponent = vm.envBytes("EMAIL_EXP");
        string memory domain = vm.envString("EMAIL_DOMAIN");
        string memory selector = vm.envString("EMAIL_SELECTOR");
        vm.startBroadcast();
        RealEmailVerifier v = new RealEmailVerifier(msg.sender);
        bytes32 id = v.registerKey(domain, selector, modulus, exponent);
        vm.stopBroadcast();
        console.log("RealEmailVerifier:", address(v));
        console.logBytes32(id);
    }
}
