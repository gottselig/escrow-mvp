// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Escrow} from "../src/Escrow.sol";
import {EscrowTypes} from "../src/libraries/EscrowTypes.sol";
import {EscrowTestBase} from "./mocks/TestHelpers.sol";

contract EscrowFeesTest is EscrowTestBase {
    function testResolveToContractorWithholdsFeeToTreasury() public {
        Escrow escrow = _disputedFromFundedEscrow();
        uint256 feeAmount = (TOTAL_AMOUNT * FEE_BPS) / 10_000;
        uint256 contractorNet = TOTAL_AMOUNT - feeAmount;

        vm.prank(arbiter);
        escrow.resolveToContractor();

        assertEq(uint256(escrow.status()), uint256(EscrowTypes.DealStatus.Resolved));
        assertEq(token.balanceOf(treasury), feeAmount);
        assertEq(token.balanceOf(contractor), contractorNet);
        assertEq(token.balanceOf(client), 0);
        assertEq(token.balanceOf(address(escrow)), 0);
    }

    function testResolveSplitWithholdsFeeOnlyFromContractorShare() public {
        Escrow escrow = _disputedFromFundedEscrow();
        uint256 clientAmount = 250 * USDC;
        uint256 contractorAmount = 750 * USDC;
        uint256 feeAmount = (contractorAmount * FEE_BPS) / 10_000;
        uint256 contractorNet = contractorAmount - feeAmount;

        vm.prank(arbiter);
        escrow.resolveSplit(clientAmount, contractorAmount);

        assertEq(uint256(escrow.status()), uint256(EscrowTypes.DealStatus.Resolved));
        assertEq(token.balanceOf(client), clientAmount);
        assertEq(token.balanceOf(treasury), feeAmount);
        assertEq(token.balanceOf(contractor), contractorNet);
        assertEq(token.balanceOf(address(escrow)), 0);
    }

    function testNativeResolveToContractorWithholdsFeeToTreasury() public {
        Escrow escrow = _fundedNativeEscrow();
        uint256 feeAmount = (ETH_TOTAL_AMOUNT * FEE_BPS) / 10_000;
        uint256 contractorNet = ETH_TOTAL_AMOUNT - feeAmount;

        vm.prank(client);
        escrow.openDispute("ipfs://native-dispute");

        vm.prank(arbiter);
        escrow.resolveToContractor();

        assertEq(uint256(escrow.status()), uint256(EscrowTypes.DealStatus.Resolved));
        assertEq(treasury.balance, feeAmount);
        assertEq(contractor.balance, contractorNet);
        assertEq(address(escrow).balance, 0);
    }

    function testNativeResolveSplitWithholdsFeeOnlyFromContractorShare() public {
        Escrow escrow = _fundedNativeEscrow();
        uint256 clientAmount = 0.25 ether;
        uint256 contractorAmount = 0.75 ether;
        uint256 feeAmount = (contractorAmount * FEE_BPS) / 10_000;
        uint256 contractorNet = contractorAmount - feeAmount;

        vm.prank(client);
        escrow.openDispute("ipfs://native-dispute");

        vm.prank(arbiter);
        escrow.resolveSplit(clientAmount, contractorAmount);

        assertEq(uint256(escrow.status()), uint256(EscrowTypes.DealStatus.Resolved));
        assertEq(client.balance, clientAmount);
        assertEq(treasury.balance, feeAmount);
        assertEq(contractor.balance, contractorNet);
        assertEq(address(escrow).balance, 0);
    }
}
