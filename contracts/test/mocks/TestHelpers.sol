// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Test} from "forge-std/Test.sol";

import {Escrow} from "../../src/Escrow.sol";
import {MosUSDC} from "../../src/MosUSDC.sol";
import {EscrowTypes} from "../../src/libraries/EscrowTypes.sol";

contract TestToken is ERC20 {
    constructor() ERC20("Test USDC", "tUSDC") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MoscowUSDToken is ERC20 {
    constructor() ERC20("Moscow USD Coin", "mUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

abstract contract EscrowTestBase is Test {
    address internal client = address(0xA11CE);
    address internal contractor = address(0xB0B);
    address internal arbiter = address(0xA4B17E4);
    address internal treasury = address(0x7E45);
    address internal stranger = address(0x57A);

    uint256 internal constant USDC = 1e6;
    uint256 internal constant TOTAL_AMOUNT = 1_000 * USDC;
    uint256 internal constant ETH_TOTAL_AMOUNT = 1 ether;
    uint96 internal constant FEE_BPS = 500;

    MosUSDC internal token;

    function setUp() public virtual {
        token = new MosUSDC(address(this), 0);
    }

    function _newEscrow() internal returns (Escrow escrow) {
        escrow = _newEscrow(TOTAL_AMOUNT, FEE_BPS);
    }

    function _newNativeEscrow() internal returns (Escrow escrow) {
        escrow = _newEscrowWithPaymentToken(address(0), ETH_TOTAL_AMOUNT, FEE_BPS);
    }

    function _newEscrow(uint256 totalAmount, uint96 feeBps) internal returns (Escrow escrow) {
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = totalAmount;

        escrow = _newEscrow(amounts, feeBps);
    }

    function _newEscrow(uint256[] memory milestoneAmounts, uint96 feeBps) internal returns (Escrow escrow) {
        escrow = _newEscrowWithPaymentToken(address(token), milestoneAmounts, feeBps);
    }

    function _newEscrowWithPaymentToken(address paymentToken, uint256 totalAmount, uint96 feeBps)
        internal
        returns (Escrow escrow)
    {
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = totalAmount;

        escrow = _newEscrowWithPaymentToken(paymentToken, amounts, feeBps);
    }

    function _newOpenEscrowWithPaymentToken(address paymentToken, uint256 totalAmount, uint96 feeBps)
        internal
        returns (Escrow escrow)
    {
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = totalAmount;

        EscrowTypes.MilestoneInput[] memory milestones = new EscrowTypes.MilestoneInput[](amounts.length);
        milestones[0] = EscrowTypes.MilestoneInput({
            amount: totalAmount,
            deadline: uint64(block.timestamp + 7 days),
            descriptionURI: "ipfs://milestone"
        });

        escrow =
            new Escrow(client, address(0), arbiter, paymentToken, treasury, totalAmount, feeBps, "ipfs://deal", milestones);
    }

    function _newEscrowWithPaymentToken(address paymentToken, uint256[] memory milestoneAmounts, uint96 feeBps)
        internal
        returns (Escrow escrow)
    {
        EscrowTypes.MilestoneInput[] memory milestones = new EscrowTypes.MilestoneInput[](milestoneAmounts.length);

        uint256 totalAmount;
        for (uint256 i = 0; i < milestoneAmounts.length; i++) {
            totalAmount += milestoneAmounts[i];
            milestones[i] = EscrowTypes.MilestoneInput({
                amount: milestoneAmounts[i],
                deadline: uint64(block.timestamp + 7 days),
                descriptionURI: "ipfs://milestone"
            });
        }

        escrow = new Escrow(
            client, contractor, arbiter, paymentToken, treasury, totalAmount, feeBps, "ipfs://deal", milestones
        );
    }

    function _fund(Escrow escrow) internal {
        uint256 amount = escrow.totalAmount();

        if (escrow.isNativePayment()) {
            vm.deal(client, amount);

            vm.prank(client);
            escrow.fund{value: amount}();
        } else {
            token.mint(client, amount);

            vm.startPrank(client);
            token.approve(address(escrow), amount);
            escrow.fund();
            vm.stopPrank();
        }
    }

    function _accept(Escrow escrow) internal {
        vm.prank(contractor);
        escrow.acceptDeal();
    }

    function _fundedEscrow() internal returns (Escrow escrow) {
        escrow = _newEscrow();
        _fund(escrow);
    }

    function _fundedNativeEscrow() internal returns (Escrow escrow) {
        escrow = _newNativeEscrow();
        _fund(escrow);
    }

    function _inProgressEscrow() internal returns (Escrow escrow) {
        escrow = _fundedEscrow();
        _accept(escrow);
    }

    function _disputedFromFundedEscrow() internal returns (Escrow escrow) {
        escrow = _fundedEscrow();
        vm.prank(client);
        escrow.openDispute("ipfs://dispute");
    }

    function _disputedFromInProgressEscrow() internal returns (Escrow escrow) {
        escrow = _inProgressEscrow();
        vm.prank(contractor);
        escrow.openDispute("ipfs://dispute");
    }

    function _submitAndApproveOnlyMilestone(Escrow escrow) internal {
        vm.prank(contractor);
        escrow.submitMilestone(0, "ipfs://result");

        vm.prank(client);
        escrow.approveMilestone(0);
    }
}
