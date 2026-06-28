// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {Escrow} from "../src/Escrow.sol";
import {EscrowFactory} from "../src/EscrowFactory.sol";
import {MosUSDC} from "../src/MosUSDC.sol";
import {EscrowTypes} from "../src/libraries/EscrowTypes.sol";

contract SeedDemoData is Script {
    uint96 internal constant DEFAULT_FEE_BPS = 500;
    uint256 internal constant DEMO_USDC_AMOUNT = 1_000 * 1e6;
    uint256 internal constant DEMO_ETH_AMOUNT = 1 ether;
    uint256 internal constant DEFAULT_INITIAL_SUPPLY = 1_000_000 * 1e6;

    function run() external returns (MosUSDC mUsdc, EscrowFactory factory, Escrow escrow) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        address owner = vm.envOr("OWNER", deployer);
        address treasury = vm.envOr("TREASURY", owner);
        address arbiter = vm.envOr("ARBITER", owner);
        address contractor = vm.envOr("CONTRACTOR", address(0xB0B));
        uint96 feeBps = uint96(vm.envOr("FEE_BPS", uint256(DEFAULT_FEE_BPS)));
        bool useNativePayment = vm.envOr("USE_NATIVE_PAYMENT", false);

        uint256 totalAmount = useNativePayment ? DEMO_ETH_AMOUNT : DEMO_USDC_AMOUNT;

        EscrowTypes.MilestoneInput[] memory milestones = new EscrowTypes.MilestoneInput[](2);
        milestones[0] = EscrowTypes.MilestoneInput({
            amount: totalAmount / 2,
            deadline: uint64(block.timestamp + 7 days),
            descriptionURI: "ipfs://demo-milestone-1"
        });
        milestones[1] = EscrowTypes.MilestoneInput({
            amount: totalAmount - milestones[0].amount,
            deadline: uint64(block.timestamp + 14 days),
            descriptionURI: "ipfs://demo-milestone-2"
        });

        vm.startBroadcast(deployerKey);

        address paymentToken;
        if (useNativePayment) {
            paymentToken = address(0);
        } else {
            uint256 initialSupply = vm.envOr("MUSDC_INITIAL_SUPPLY", DEFAULT_INITIAL_SUPPLY);
            mUsdc = new MosUSDC(deployer, initialSupply);
            paymentToken = address(mUsdc);
        }

        factory = new EscrowFactory(owner, treasury, arbiter, paymentToken, feeBps);
        escrow = Escrow(factory.createEscrow(contractor, arbiter, totalAmount, milestones, "ipfs://demo-deal"));

        if (useNativePayment) {
            escrow.fund{value: totalAmount}();
        } else {
            mUsdc.approve(address(escrow), totalAmount);
            escrow.fund();
        }

        vm.stopBroadcast();

        console2.log("MosUSDC:", address(mUsdc));
        console2.log("EscrowFactory:", address(factory));
        console2.log("Escrow:", address(escrow));
        console2.log("Payment token:", paymentToken);
        console2.log("Owner:", owner);
        console2.log("Client:", deployer);
        console2.log("Contractor:", contractor);
        console2.log("Arbiter:", arbiter);
        console2.log("Treasury:", treasury);
        console2.log("Total amount:", totalAmount);
    }
}
