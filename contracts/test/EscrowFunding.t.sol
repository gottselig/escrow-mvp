// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Escrow} from "../src/Escrow.sol";
import {EscrowErrors} from "../src/common/EscrowErrors.sol";
import {EscrowTypes} from "../src/libraries/EscrowTypes.sol";
import {EscrowTestBase, TestToken} from "./mocks/TestHelpers.sol";

contract EscrowFundingTest is EscrowTestBase {
    event DealAccepted(address indexed contractor);
    event DealFunded(address indexed client, uint256 amount);
    event StatusChanged(EscrowTypes.DealStatus oldStatus, EscrowTypes.DealStatus newStatus);

    function testFundedAcceptDealMovesToInProgress() public {
        Escrow escrow = _fundedEscrow();

        assertEq(uint256(escrow.status()), uint256(EscrowTypes.DealStatus.Funded));

        vm.prank(contractor);
        escrow.acceptDeal();

        assertEq(uint256(escrow.status()), uint256(EscrowTypes.DealStatus.InProgress));
        assertEq(escrow.fundedAmount(), TOTAL_AMOUNT);
        assertEq(escrow.remainingBalance(), TOTAL_AMOUNT);
        assertEq(token.balanceOf(address(escrow)), TOTAL_AMOUNT);
        assertEq(escrow.token(), address(token));
        assertEq(address(escrow.mUSDC()), address(token));
        assertFalse(escrow.isNativePayment());
    }

    function testFundEmitsEvents() public {
        Escrow escrow = _newEscrow();
        token.mint(client, TOTAL_AMOUNT);

        vm.startPrank(client);
        token.approve(address(escrow), TOTAL_AMOUNT);
        vm.expectEmit(false, false, false, true);
        emit StatusChanged(EscrowTypes.DealStatus.Created, EscrowTypes.DealStatus.Funded);
        vm.expectEmit(true, false, false, true);
        emit DealFunded(client, TOTAL_AMOUNT);
        escrow.fund();
        vm.stopPrank();
    }

    function testAcceptDealEmitsEvents() public {
        Escrow escrow = _fundedEscrow();

        vm.prank(contractor);
        vm.expectEmit(false, false, false, true);
        emit StatusChanged(EscrowTypes.DealStatus.Funded, EscrowTypes.DealStatus.InProgress);
        vm.expectEmit(true, false, false, true);
        emit DealAccepted(contractor);
        escrow.acceptDeal();
    }

    function testOpenUnfundedDealCannotBeAcceptedByExecutor() public {
        Escrow escrow = _newOpenEscrowWithPaymentToken(address(token), TOTAL_AMOUNT, FEE_BPS);

        assertEq(escrow.contractor(), address(0));

        vm.prank(contractor);
        vm.expectRevert(EscrowErrors.InvalidStatus.selector);
        escrow.acceptDeal();

        assertEq(escrow.contractor(), address(0));
        assertEq(uint256(escrow.status()), uint256(EscrowTypes.DealStatus.Created));
    }

    function testClientCannotAcceptOwnOpenDeal() public {
        Escrow escrow = _newOpenEscrowWithPaymentToken(address(token), TOTAL_AMOUNT, FEE_BPS);

        vm.prank(client);
        vm.expectRevert(EscrowErrors.NotContractor.selector);
        escrow.acceptDeal();
    }

    function testTreasuryCannotAcceptOpenDealAsContractor() public {
        Escrow escrow = _newOpenEscrowWithPaymentToken(address(token), TOTAL_AMOUNT, FEE_BPS);

        vm.prank(treasury);
        vm.expectRevert(EscrowErrors.TreasuryCannotActAsContractor.selector);
        escrow.acceptDeal();
    }

    function testOpenFundedDealMovesToInProgressWhenExecutorAccepts() public {
        Escrow escrow = _newOpenEscrowWithPaymentToken(address(token), TOTAL_AMOUNT, FEE_BPS);
        _fund(escrow);

        assertEq(uint256(escrow.status()), uint256(EscrowTypes.DealStatus.Funded));

        vm.prank(contractor);
        escrow.acceptDeal();

        assertEq(escrow.contractor(), contractor);
        assertEq(uint256(escrow.status()), uint256(EscrowTypes.DealStatus.InProgress));
    }

    function testClientCanUpdateOpenUnfundedDeal() public {
        Escrow escrow = _newOpenEscrowWithPaymentToken(address(token), TOTAL_AMOUNT, FEE_BPS);
        EscrowTypes.MilestoneInput[] memory milestones = new EscrowTypes.MilestoneInput[](2);
        milestones[0] = EscrowTypes.MilestoneInput({
            amount: 300 * USDC, deadline: uint64(block.timestamp + 10 days), descriptionURI: "ipfs://updated-1"
        });
        milestones[1] = EscrowTypes.MilestoneInput({
            amount: 700 * USDC, deadline: uint64(block.timestamp + 20 days), descriptionURI: "ipfs://updated-2"
        });

        vm.prank(client);
        escrow.updateDeal(TOTAL_AMOUNT, milestones, "ipfs://updated-deal");

        assertEq(escrow.metadataURI(), "ipfs://updated-deal");
        assertEq(escrow.getMilestonesCount(), 2);

        EscrowTypes.Milestone memory firstMilestone = escrow.getMilestone(0);
        assertEq(firstMilestone.amount, 300 * USDC);
        assertEq(firstMilestone.descriptionURI, "ipfs://updated-1");
    }

    function testClientCanCancelFundedOpenDealAndReceiveRefund() public {
        Escrow escrow = _newOpenEscrowWithPaymentToken(address(token), TOTAL_AMOUNT, FEE_BPS);
        _fund(escrow);

        vm.prank(client);
        escrow.cancelBeforeFunding();

        assertEq(uint256(escrow.status()), uint256(EscrowTypes.DealStatus.Cancelled));
        assertEq(escrow.remainingBalance(), 0);
        assertEq(token.balanceOf(client), TOTAL_AMOUNT);
        assertEq(token.balanceOf(address(escrow)), 0);
    }

    function testFundRevertsWhenNotClient() public {
        Escrow escrow = _newEscrow();

        vm.prank(stranger);
        vm.expectRevert(EscrowErrors.NotClient.selector);
        escrow.fund();
    }

    function testAcceptDealRevertsWhenNotContractor() public {
        Escrow escrow = _newEscrow();

        vm.prank(stranger);
        vm.expectRevert(EscrowErrors.NotContractor.selector);
        escrow.acceptDeal();
    }

    function testFundRevertsWhenAlreadyFunded() public {
        Escrow escrow = _fundedEscrow();
        token.mint(client, TOTAL_AMOUNT);

        vm.startPrank(client);
        token.approve(address(escrow), TOTAL_AMOUNT);
        vm.expectRevert(EscrowErrors.AlreadyFunded.selector);
        escrow.fund();
        vm.stopPrank();
    }

    function testFundRevertsWhenERC20PaymentReceivesNativeValue() public {
        Escrow escrow = _newEscrow();
        token.mint(client, TOTAL_AMOUNT);
        vm.deal(client, 1 wei);

        vm.startPrank(client);
        token.approve(address(escrow), TOTAL_AMOUNT);
        vm.expectRevert(EscrowErrors.InvalidNativeAmount.selector);
        escrow.fund{value: 1 wei}();
        vm.stopPrank();
    }

    function testNativeFundAcceptsExactETH() public {
        Escrow escrow = _newNativeEscrow();

        _fund(escrow);

        assertEq(uint256(escrow.status()), uint256(EscrowTypes.DealStatus.Funded));
        assertEq(escrow.fundedAmount(), ETH_TOTAL_AMOUNT);
        assertEq(escrow.remainingBalance(), ETH_TOTAL_AMOUNT);
        assertEq(address(escrow).balance, ETH_TOTAL_AMOUNT);
        assertEq(escrow.token(), address(0));
        assertEq(address(escrow.mUSDC()), address(0));
        assertTrue(escrow.isNativePayment());
    }

    function testNativeFundRevertsWhenValueIsWrong() public {
        Escrow escrow = _newNativeEscrow();
        vm.deal(client, ETH_TOTAL_AMOUNT);

        vm.prank(client);
        vm.expectRevert(EscrowErrors.InvalidNativeAmount.selector);
        escrow.fund{value: ETH_TOTAL_AMOUNT - 1}();
    }

    function testEscrowRejectsNonMosUSDCToken() public {
        TestToken otherToken = new TestToken();
        EscrowTypes.MilestoneInput[] memory milestones = new EscrowTypes.MilestoneInput[](1);
        milestones[0] = EscrowTypes.MilestoneInput({
            amount: TOTAL_AMOUNT, deadline: uint64(block.timestamp + 7 days), descriptionURI: "ipfs://milestone"
        });

        vm.expectRevert(EscrowErrors.TokenNotAllowed.selector);
        new Escrow(
            client, contractor, arbiter, address(otherToken), treasury, TOTAL_AMOUNT, FEE_BPS, "ipfs://deal", milestones
        );
    }

    function testArbiterCanCancelUnfundedDeal() public {
        Escrow escrow = _newEscrow();

        vm.prank(arbiter);
        escrow.cancelBeforeFunding();

        assertEq(uint256(escrow.status()), uint256(EscrowTypes.DealStatus.Cancelled));
    }

    function testArbiterCannotCancelFundedDeal() public {
        Escrow escrow = _fundedEscrow();

        vm.prank(arbiter);
        vm.expectRevert(EscrowErrors.InvalidStatus.selector);
        escrow.cancelBeforeFunding();
    }

    function testArbiterCanUpdateUnfundedDeal() public {
        Escrow escrow = _newOpenEscrowWithPaymentToken(address(token), TOTAL_AMOUNT, FEE_BPS);
        EscrowTypes.MilestoneInput[] memory milestones = new EscrowTypes.MilestoneInput[](2);
        milestones[0] = EscrowTypes.MilestoneInput({
            amount: 400 * USDC, deadline: uint64(block.timestamp + 10 days), descriptionURI: "ipfs://arbiter-m1"
        });
        milestones[1] = EscrowTypes.MilestoneInput({
            amount: 600 * USDC, deadline: uint64(block.timestamp + 20 days), descriptionURI: "ipfs://arbiter-m2"
        });

        vm.prank(arbiter);
        escrow.updateDeal(TOTAL_AMOUNT, milestones, "ipfs://arbiter-updated");

        assertEq(escrow.metadataURI(), "ipfs://arbiter-updated");
        assertEq(escrow.getMilestonesCount(), 2);
        assertEq(escrow.getMilestone(0).amount, 400 * USDC);
    }

    function testArbiterCannotUpdateFundedDeal() public {
        Escrow escrow = _fundedEscrow();
        EscrowTypes.MilestoneInput[] memory milestones = new EscrowTypes.MilestoneInput[](1);
        milestones[0] = EscrowTypes.MilestoneInput({
            amount: TOTAL_AMOUNT, deadline: uint64(block.timestamp + 7 days), descriptionURI: "ipfs://m"
        });

        vm.prank(arbiter);
        vm.expectRevert(EscrowErrors.InvalidStatus.selector);
        escrow.updateDeal(TOTAL_AMOUNT, milestones, "ipfs://updated");
    }

    function testStrangerCannotCancelDeal() public {
        Escrow escrow = _newEscrow();

        vm.prank(stranger);
        vm.expectRevert(EscrowErrors.NotAuthorized.selector);
        escrow.cancelBeforeFunding();
    }

    function testStrangerCannotUpdateDeal() public {
        Escrow escrow = _newEscrow();
        EscrowTypes.MilestoneInput[] memory milestones = new EscrowTypes.MilestoneInput[](1);
        milestones[0] = EscrowTypes.MilestoneInput({
            amount: TOTAL_AMOUNT, deadline: uint64(block.timestamp + 7 days), descriptionURI: "ipfs://m"
        });

        vm.prank(stranger);
        vm.expectRevert(EscrowErrors.NotAuthorized.selector);
        escrow.updateDeal(TOTAL_AMOUNT, milestones, "ipfs://updated");
    }
}
