// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Escrow} from "../src/Escrow.sol";
import {EscrowErrors} from "../src/common/EscrowErrors.sol";
import {EscrowTypes} from "../src/libraries/EscrowTypes.sol";
import {EscrowTestBase} from "./mocks/TestHelpers.sol";

contract EscrowMilestonesTest is EscrowTestBase {
    event MilestoneSubmitted(uint256 indexed milestoneId, string resultURI);
    event MilestoneApproved(uint256 indexed milestoneId, uint256 grossAmount, uint256 feeAmount, uint256 netAmount);
    event StatusChanged(EscrowTypes.DealStatus oldStatus, EscrowTypes.DealStatus newStatus);

    function testSubmitMilestoneOnlyContractor() public {
        Escrow escrow = _inProgressEscrow();

        vm.prank(stranger);
        vm.expectRevert(EscrowErrors.NotContractor.selector);
        escrow.submitMilestone(0, "ipfs://result");
    }

    function testApproveMilestoneOnlyClient() public {
        Escrow escrow = _inProgressEscrow();

        vm.prank(contractor);
        escrow.submitMilestone(0, "ipfs://result");

        vm.prank(stranger);
        vm.expectRevert(EscrowErrors.NotClient.selector);
        escrow.approveMilestone(0);
    }

    function testSubmitMilestoneRequiresInProgressStatus() public {
        Escrow escrow = _fundedEscrow();

        vm.prank(contractor);
        vm.expectRevert(EscrowErrors.InvalidStatus.selector);
        escrow.submitMilestone(0, "ipfs://result");
    }

    function testApproveMilestoneRequiresInProgressStatus() public {
        Escrow escrow = _fundedEscrow();

        vm.prank(client);
        vm.expectRevert(EscrowErrors.InvalidStatus.selector);
        escrow.approveMilestone(0);
    }

    function testSubmitMilestoneEmitsEventAndStoresResultURI() public {
        Escrow escrow = _inProgressEscrow();

        vm.prank(contractor);
        vm.expectEmit(true, false, false, true);
        emit MilestoneSubmitted(0, "ipfs://result");
        escrow.submitMilestone(0, "ipfs://result");

        EscrowTypes.Milestone memory milestone = escrow.getMilestone(0);
        assertEq(uint256(milestone.status), uint256(EscrowTypes.MilestoneStatus.Submitted));
        assertEq(milestone.resultURI, "ipfs://result");
    }

    function testApproveMilestonePaysContractorMinusFeeAndCompletesDeal() public {
        Escrow escrow = _inProgressEscrow();
        uint256 feeAmount = (TOTAL_AMOUNT * FEE_BPS) / 10_000;
        uint256 contractorNet = TOTAL_AMOUNT - feeAmount;

        vm.prank(contractor);
        escrow.submitMilestone(0, "ipfs://result");

        vm.prank(client);
        vm.expectEmit(true, false, false, true);
        emit MilestoneApproved(0, TOTAL_AMOUNT, feeAmount, contractorNet);
        vm.expectEmit(false, false, false, true);
        emit StatusChanged(EscrowTypes.DealStatus.InProgress, EscrowTypes.DealStatus.Completed);
        escrow.approveMilestone(0);

        EscrowTypes.Milestone memory milestone = escrow.getMilestone(0);
        assertEq(uint256(milestone.status), uint256(EscrowTypes.MilestoneStatus.Approved));
        assertEq(uint256(escrow.status()), uint256(EscrowTypes.DealStatus.Completed));
        assertEq(escrow.releasedAmount(), TOTAL_AMOUNT);
        assertEq(token.balanceOf(contractor), contractorNet);
        assertEq(token.balanceOf(treasury), feeAmount);
        assertEq(token.balanceOf(address(escrow)), 0);
    }

    function testCannotSubmitMilestoneAfterCompleted() public {
        Escrow escrow = _inProgressEscrow();
        _submitAndApproveOnlyMilestone(escrow);

        vm.prank(contractor);
        vm.expectRevert(EscrowErrors.InvalidStatus.selector);
        escrow.submitMilestone(0, "ipfs://again");
    }
}
