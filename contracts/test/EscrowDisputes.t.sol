// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Escrow} from "../src/Escrow.sol";
import {EscrowErrors} from "../src/common/EscrowErrors.sol";
import {EscrowTypes} from "../src/libraries/EscrowTypes.sol";
import {EscrowTestBase} from "./mocks/TestHelpers.sol";

contract EscrowDisputesTest is EscrowTestBase {
    event DisputeOpened(address indexed openedBy, string reasonURI);
    event DisputeResolvedToClient(uint256 amount);
    event DisputeResolvedToContractor(uint256 amount);
    event DisputeResolvedSplit(uint256 clientAmount, uint256 contractorAmount);

    function testOpenDisputeFromFunded() public {
        Escrow escrow = _fundedEscrow();

        vm.prank(client);
        escrow.openDispute("ipfs://funded-dispute");

        assertEq(uint256(escrow.status()), uint256(EscrowTypes.DealStatus.Disputed));
        assertEq(escrow.disputeReasonURI(), "ipfs://funded-dispute");
    }

    function testOpenDisputeFromInProgress() public {
        Escrow escrow = _inProgressEscrow();

        vm.prank(contractor);
        escrow.openDispute("ipfs://in-progress-dispute");

        assertEq(uint256(escrow.status()), uint256(EscrowTypes.DealStatus.Disputed));
        assertEq(escrow.disputeReasonURI(), "ipfs://in-progress-dispute");
    }

    function testOpenDisputeRevertsOutsideFundedOrInProgress() public {
        _expectOpenDisputeInvalid(_newEscrow());

        Escrow disputedEscrow = _disputedFromFundedEscrow();
        _expectOpenDisputeInvalid(disputedEscrow);

        Escrow resolvedEscrow = _disputedFromFundedEscrow();
        vm.prank(arbiter);
        resolvedEscrow.resolveToClient();
        _expectOpenDisputeInvalid(resolvedEscrow);

        Escrow completedEscrow = _inProgressEscrow();
        _submitAndApproveOnlyMilestone(completedEscrow);
        _expectOpenDisputeInvalid(completedEscrow);

        Escrow cancelledEscrow = _newEscrow();
        vm.prank(client);
        cancelledEscrow.cancelBeforeFunding();
        _expectOpenDisputeInvalid(cancelledEscrow);
    }

    function testOpenDisputeFromFundedByContractor() public {
        Escrow escrow = _fundedEscrow();

        vm.prank(contractor);
        escrow.openDispute("ipfs://funded-dispute-by-contractor");

        assertEq(uint256(escrow.status()), uint256(EscrowTypes.DealStatus.Disputed));
        assertEq(escrow.disputeReasonURI(), "ipfs://funded-dispute-by-contractor");
    }

    function testOpenDisputeFromInProgressByClient() public {
        Escrow escrow = _inProgressEscrow();

        vm.prank(client);
        escrow.openDispute("ipfs://in-progress-dispute-by-client");

        assertEq(uint256(escrow.status()), uint256(EscrowTypes.DealStatus.Disputed));
        assertEq(escrow.disputeReasonURI(), "ipfs://in-progress-dispute-by-client");
    }

    function testOpenDisputeRevertsWhenNotParticipant() public {
        Escrow escrow = _fundedEscrow();

        vm.prank(arbiter);
        vm.expectRevert(EscrowErrors.NotParticipant.selector);
        escrow.openDispute("ipfs://bad-dispute");
    }

    function testOpenDisputeEmitsEvent() public {
        Escrow escrow = _fundedEscrow();

        vm.prank(client);
        vm.expectEmit(true, false, false, true);
        emit DisputeOpened(client, "ipfs://funded-dispute");
        escrow.openDispute("ipfs://funded-dispute");
    }

    function testResolveToClientRevertsWhenNotArbiter() public {
        Escrow escrow = _disputedFromFundedEscrow();

        vm.prank(client);
        vm.expectRevert(EscrowErrors.NotArbiter.selector);
        escrow.resolveToClient();
    }

    function testResolveToContractorRevertsWhenNotArbiter() public {
        Escrow escrow = _disputedFromInProgressEscrow();

        vm.prank(contractor);
        vm.expectRevert(EscrowErrors.NotArbiter.selector);
        escrow.resolveToContractor();
    }

    function testResolveSplitRevertsWhenNotArbiter() public {
        Escrow escrow = _disputedFromInProgressEscrow();

        vm.prank(client);
        vm.expectRevert(EscrowErrors.NotArbiter.selector);
        escrow.resolveSplit(400 * USDC, 600 * USDC);
    }

    function testResolveToClientEmitsEvent() public {
        Escrow escrow = _disputedFromFundedEscrow();

        vm.prank(arbiter);
        vm.expectEmit(false, false, false, true);
        emit DisputeResolvedToClient(TOTAL_AMOUNT);
        escrow.resolveToClient();
    }

    function testResolveToContractorEmitsEvent() public {
        Escrow escrow = _disputedFromInProgressEscrow();
        uint256 feeAmount = (TOTAL_AMOUNT * FEE_BPS) / 10_000;
        uint256 contractorNet = TOTAL_AMOUNT - feeAmount;

        vm.prank(arbiter);
        vm.expectEmit(false, false, false, true);
        emit DisputeResolvedToContractor(TOTAL_AMOUNT);
        escrow.resolveToContractor();

        assertEq(token.balanceOf(contractor), contractorNet);
        assertEq(token.balanceOf(treasury), feeAmount);
    }

    function testResolveSplitEmitsEvent() public {
        Escrow escrow = _disputedFromInProgressEscrow();
        uint256 clientAmount = 400 * USDC;
        uint256 contractorAmount = 600 * USDC;

        vm.prank(arbiter);
        vm.expectEmit(false, false, false, true);
        emit DisputeResolvedSplit(clientAmount, contractorAmount);
        escrow.resolveSplit(clientAmount, contractorAmount);
    }

    function testResolveSplitRevertsUnlessFullRemainingBalanceIsDistributed() public {
        Escrow escrow = _disputedFromFundedEscrow();

        vm.prank(arbiter);
        vm.expectRevert(EscrowErrors.DistributionExceedsBalance.selector);
        escrow.resolveSplit(400 * USDC, 500 * USDC);
    }

    function testResolveToClientReturnsRemainingBalance() public {
        Escrow escrow = _disputedFromFundedEscrow();

        vm.prank(arbiter);
        escrow.resolveToClient();

        assertEq(uint256(escrow.status()), uint256(EscrowTypes.DealStatus.Resolved));
        assertEq(escrow.releasedAmount(), TOTAL_AMOUNT);
        assertEq(escrow.remainingBalance(), 0);
        assertEq(token.balanceOf(client), TOTAL_AMOUNT);
        assertEq(token.balanceOf(contractor), 0);
        assertEq(token.balanceOf(treasury), 0);
        assertEq(token.balanceOf(address(escrow)), 0);
    }

    function testResolveToContractorReleasesRemainingBalanceMinusFee() public {
        Escrow escrow = _disputedFromInProgressEscrow();
        uint256 feeAmount = (TOTAL_AMOUNT * FEE_BPS) / 10_000;
        uint256 contractorNet = TOTAL_AMOUNT - feeAmount;

        vm.prank(arbiter);
        escrow.resolveToContractor();

        assertEq(uint256(escrow.status()), uint256(EscrowTypes.DealStatus.Resolved));
        assertEq(escrow.releasedAmount(), TOTAL_AMOUNT);
        assertEq(escrow.remainingBalance(), 0);
        assertEq(token.balanceOf(client), 0);
        assertEq(token.balanceOf(contractor), contractorNet);
        assertEq(token.balanceOf(treasury), feeAmount);
        assertEq(token.balanceOf(address(escrow)), 0);
    }

    function testResolveSplitDistributesRemainingBalance() public {
        Escrow escrow = _disputedFromInProgressEscrow();
        uint256 clientAmount = 400 * USDC;
        uint256 contractorAmount = 600 * USDC;
        uint256 feeAmount = (contractorAmount * FEE_BPS) / 10_000;
        uint256 contractorNet = contractorAmount - feeAmount;

        vm.prank(arbiter);
        escrow.resolveSplit(clientAmount, contractorAmount);

        assertEq(uint256(escrow.status()), uint256(EscrowTypes.DealStatus.Resolved));
        assertEq(escrow.releasedAmount(), TOTAL_AMOUNT);
        assertEq(escrow.remainingBalance(), 0);
        assertEq(token.balanceOf(client), clientAmount);
        assertEq(token.balanceOf(contractor), contractorNet);
        assertEq(token.balanceOf(treasury), feeAmount);
        assertEq(token.balanceOf(address(escrow)), 0);
    }

    function testDisputeAfterPartialMilestoneApprovedResolvesToClientRemainingBalance() public {
        uint256[] memory milestoneAmounts = new uint256[](2);
        milestoneAmounts[0] = 400 * USDC;
        milestoneAmounts[1] = 600 * USDC;

        Escrow escrow = _newEscrow(milestoneAmounts, FEE_BPS);
        _fund(escrow);
        _accept(escrow);

        vm.prank(contractor);
        escrow.submitMilestone(0, "ipfs://result");
        vm.prank(client);
        escrow.approveMilestone(0);

        vm.prank(client);
        escrow.openDispute("ipfs://partial-dispute");

        assertEq(uint256(escrow.status()), uint256(EscrowTypes.DealStatus.Disputed));
        assertEq(escrow.disputeReasonURI(), "ipfs://partial-dispute");
        assertEq(escrow.releasedAmount(), 400 * USDC);
        assertEq(escrow.remainingBalance(), 600 * USDC);

        vm.prank(arbiter);
        escrow.resolveToClient();

        assertEq(uint256(escrow.status()), uint256(EscrowTypes.DealStatus.Resolved));
        assertEq(escrow.releasedAmount(), TOTAL_AMOUNT);
        assertEq(escrow.remainingBalance(), 0);
        assertEq(token.balanceOf(client), 600 * USDC);
        assertEq(token.balanceOf(contractor), 380 * USDC);
        assertEq(token.balanceOf(treasury), 20 * USDC);
    }

    function testDisputeAfterPartialMilestoneApprovedResolvesToContractorRemainingBalanceMinusFee() public {
        uint256[] memory milestoneAmounts = new uint256[](2);
        milestoneAmounts[0] = 400 * USDC;
        milestoneAmounts[1] = 600 * USDC;

        Escrow escrow = _newEscrow(milestoneAmounts, FEE_BPS);
        _fund(escrow);
        _accept(escrow);

        vm.prank(contractor);
        escrow.submitMilestone(0, "ipfs://result");
        vm.prank(client);
        escrow.approveMilestone(0);

        vm.prank(contractor);
        escrow.openDispute("ipfs://partial-dispute");

        uint256 remaining = 600 * USDC;
        uint256 feeAmount = (remaining * FEE_BPS) / 10_000;
        uint256 contractorNet = remaining - feeAmount;

        vm.prank(arbiter);
        escrow.resolveToContractor();

        assertEq(uint256(escrow.status()), uint256(EscrowTypes.DealStatus.Resolved));
        assertEq(escrow.releasedAmount(), TOTAL_AMOUNT);
        assertEq(escrow.remainingBalance(), 0);
        assertEq(token.balanceOf(client), 0);
        assertEq(token.balanceOf(contractor), 380 * USDC + contractorNet);
        assertEq(token.balanceOf(treasury), 20 * USDC + feeAmount);
    }

    function testDisputeAfterPartialMilestoneApprovedResolveSplitRemainingBalance() public {
        uint256[] memory milestoneAmounts = new uint256[](2);
        milestoneAmounts[0] = 400 * USDC;
        milestoneAmounts[1] = 600 * USDC;

        Escrow escrow = _newEscrow(milestoneAmounts, FEE_BPS);
        _fund(escrow);
        _accept(escrow);

        vm.prank(contractor);
        escrow.submitMilestone(0, "ipfs://result");
        vm.prank(client);
        escrow.approveMilestone(0);

        vm.prank(client);
        escrow.openDispute("ipfs://partial-dispute");

        uint256 clientAmount = 200 * USDC;
        uint256 contractorAmount = 400 * USDC;
        uint256 feeAmount = (contractorAmount * FEE_BPS) / 10_000;
        uint256 contractorNet = contractorAmount - feeAmount;

        vm.prank(arbiter);
        escrow.resolveSplit(clientAmount, contractorAmount);

        assertEq(uint256(escrow.status()), uint256(EscrowTypes.DealStatus.Resolved));
        assertEq(escrow.releasedAmount(), TOTAL_AMOUNT);
        assertEq(escrow.remainingBalance(), 0);
        assertEq(token.balanceOf(client), clientAmount);
        assertEq(token.balanceOf(contractor), 380 * USDC + contractorNet);
        assertEq(token.balanceOf(treasury), 20 * USDC + feeAmount);
    }

    function testDisputeAfterMultipleMilestonesApproved() public {
        uint256[] memory milestoneAmounts = new uint256[](3);
        milestoneAmounts[0] = 300 * USDC;
        milestoneAmounts[1] = 300 * USDC;
        milestoneAmounts[2] = 400 * USDC;

        Escrow escrow = _newEscrow(milestoneAmounts, FEE_BPS);
        _fund(escrow);
        _accept(escrow);

        vm.prank(contractor);
        escrow.submitMilestone(0, "ipfs://result0");
        vm.prank(client);
        escrow.approveMilestone(0);

        vm.prank(contractor);
        escrow.submitMilestone(1, "ipfs://result1");
        vm.prank(client);
        escrow.approveMilestone(1);

        vm.prank(client);
        escrow.openDispute("ipfs://multi-dispute");

        assertEq(uint256(escrow.status()), uint256(EscrowTypes.DealStatus.Disputed));
        assertEq(escrow.disputeReasonURI(), "ipfs://multi-dispute");
        assertEq(escrow.releasedAmount(), 600 * USDC);
        assertEq(escrow.remainingBalance(), 400 * USDC);
    }

    function testDisputeAfterMultipleMilestonesApprovedResolvesToClientRemainingBalance() public {
        uint256[] memory milestoneAmounts = new uint256[](3);
        milestoneAmounts[0] = 300 * USDC;
        milestoneAmounts[1] = 300 * USDC;
        milestoneAmounts[2] = 400 * USDC;

        Escrow escrow = _newEscrow(milestoneAmounts, FEE_BPS);
        _fund(escrow);
        _accept(escrow);

        vm.prank(contractor);
        escrow.submitMilestone(0, "ipfs://result0");
        vm.prank(client);
        escrow.approveMilestone(0);

        vm.prank(contractor);
        escrow.submitMilestone(1, "ipfs://result1");
        vm.prank(client);
        escrow.approveMilestone(1);

        vm.prank(contractor);
        escrow.openDispute("ipfs://multi-dispute");

        vm.prank(arbiter);
        escrow.resolveToClient();

        assertEq(uint256(escrow.status()), uint256(EscrowTypes.DealStatus.Resolved));
        assertEq(escrow.releasedAmount(), 1000 * USDC);
        assertEq(escrow.remainingBalance(), 0);
        assertEq(token.balanceOf(client), 400 * USDC);
        assertEq(token.balanceOf(contractor), 570 * USDC);
        assertEq(token.balanceOf(treasury), 30 * USDC);
    }

    function testDisputeAfterMultipleMilestonesApprovedResolveSplitRemainingBalance() public {
        uint256[] memory milestoneAmounts = new uint256[](3);
        milestoneAmounts[0] = 300 * USDC;
        milestoneAmounts[1] = 300 * USDC;
        milestoneAmounts[2] = 400 * USDC;

        Escrow escrow = _newEscrow(milestoneAmounts, FEE_BPS);
        _fund(escrow);
        _accept(escrow);

        vm.prank(contractor);
        escrow.submitMilestone(0, "ipfs://result0");
        vm.prank(client);
        escrow.approveMilestone(0);

        vm.prank(contractor);
        escrow.submitMilestone(1, "ipfs://result1");
        vm.prank(client);
        escrow.approveMilestone(1);

        vm.prank(client);
        escrow.openDispute("ipfs://multi-dispute");

        uint256 clientAmount = 100 * USDC;
        uint256 contractorAmount = 300 * USDC;
        uint256 feeAmount = (contractorAmount * FEE_BPS) / 10_000;
        uint256 contractorNet = contractorAmount - feeAmount;

        vm.prank(arbiter);
        escrow.resolveSplit(clientAmount, contractorAmount);

        assertEq(uint256(escrow.status()), uint256(EscrowTypes.DealStatus.Resolved));
        assertEq(escrow.releasedAmount(), 1000 * USDC);
        assertEq(escrow.remainingBalance(), 0);
        assertEq(token.balanceOf(client), clientAmount);
        assertEq(token.balanceOf(contractor), 570 * USDC + contractorNet);
        assertEq(token.balanceOf(treasury), 30 * USDC + feeAmount);
    }

    function _expectOpenDisputeInvalid(Escrow escrow) private {
        vm.prank(client);
        vm.expectRevert(EscrowErrors.InvalidStatus.selector);
        escrow.openDispute("ipfs://invalid-status");
    }
}
