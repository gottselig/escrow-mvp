// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {EscrowFactory} from "../src/EscrowFactory.sol";
import {MosUSDC} from "../src/MosUSDC.sol";

contract DeployFactory is Script {
    uint96 internal constant DEFAULT_FEE_BPS = 500;
    uint256 internal constant DEFAULT_INITIAL_SUPPLY = 1_000_000 * 1e6;

    function run() external returns (MosUSDC mUsdc, EscrowFactory factory) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        address owner = vm.envOr("OWNER", deployer);
        address treasury = vm.envOr("TREASURY", owner);
        address arbiter = vm.envOr("ARBITER", owner);
        uint96 feeBps = uint96(vm.envOr("FEE_BPS", uint256(DEFAULT_FEE_BPS)));
        bool useNativePayment = vm.envOr("USE_NATIVE_PAYMENT", false);
        address existingMosUSDC = vm.envOr("MOS_USDC_ADDRESS", address(0));

        vm.startBroadcast(deployerKey);

        address paymentToken;
        if (useNativePayment) {
            paymentToken = address(0);
        } else if (existingMosUSDC != address(0)) {
            mUsdc = MosUSDC(existingMosUSDC);
            paymentToken = existingMosUSDC;
        } else {
            uint256 initialSupply = vm.envOr("MUSDC_INITIAL_SUPPLY", DEFAULT_INITIAL_SUPPLY);
            mUsdc = new MosUSDC(owner, initialSupply);
            paymentToken = address(mUsdc);
        }

        factory = new EscrowFactory(owner, treasury, arbiter, paymentToken, feeBps);
        factory.setTreasury(address(factory));

        vm.stopBroadcast();

        console2.log("EscrowFactory:", address(factory));
        console2.log("Payment token:", paymentToken);
        console2.log("Owner:", owner);
        console2.log("Treasury:", factory.treasury());
        console2.log("Arbiter:", arbiter);
        console2.log("Fee bps:", feeBps);
    }
}
