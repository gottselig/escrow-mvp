// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";

import {Escrow} from "../src/Escrow.sol";
import {EscrowFactory} from "../src/EscrowFactory.sol";
import {MosUSDC} from "../src/MosUSDC.sol";
import {EscrowErrors} from "../src/common/EscrowErrors.sol";
import {EscrowTypes} from "../src/libraries/EscrowTypes.sol";
import {MoscowUSDToken, TestToken} from "./mocks/TestHelpers.sol";

contract EscrowFactoryTest is Test {
    address internal owner = address(0xA11CE);
    address internal client = address(0xC11E47);
    address internal contractor = address(0xB0B);
    address internal arbiter = address(0xA4B17E4);
    address internal treasury = address(0x7E45);

    uint96 internal constant FEE_BPS = 500;
    uint256 internal constant USDC = 1e6;
    uint256 internal constant TOTAL_AMOUNT = 1_000 * USDC;
    uint256 internal constant ETH_TOTAL_AMOUNT = 1 ether;

    MosUSDC internal token;
    EscrowFactory internal factory;

    event AllowedTokenUpdated(address indexed oldToken, address indexed newToken);
    event PaymentTokenUpdated(address indexed oldToken, address indexed newToken);
    event MosUSDCUpdated(address indexed oldToken, address indexed newToken);
    event FeesWithdrawn(address indexed token, address indexed recipient, uint256 amount);

    function setUp() public {
        token = new MosUSDC(owner, 0);
        factory = new EscrowFactory(owner, treasury, arbiter, address(token), FEE_BPS);
        vm.prank(owner);
        factory.setTreasury(address(factory));
    }

    function testConstructorRejectsNonMosUSDCToken() public {
        TestToken otherToken = new TestToken();

        vm.expectRevert(EscrowErrors.TokenNotAllowed.selector);
        new EscrowFactory(owner, treasury, arbiter, address(otherToken), FEE_BPS);
    }

    function testConstructorAllowsDeployedMoscowUSDTokenMetadata() public {
        MoscowUSDToken deployedToken = new MoscowUSDToken();
        EscrowFactory deployedFactory = new EscrowFactory(owner, treasury, arbiter, address(deployedToken), FEE_BPS);

        assertEq(deployedFactory.mosUSDC(), address(deployedToken));
        assertEq(deployedFactory.allowedToken(), address(deployedToken));
    }

    function testSetAllowedTokenRejectsNonMosUSDCToken() public {
        TestToken otherToken = new TestToken();

        vm.prank(owner);
        vm.expectRevert(EscrowErrors.TokenNotAllowed.selector);
        factory.setAllowedToken(address(otherToken));
    }

    function testConstructorAllowsNativeETHPayment() public {
        EscrowFactory nativeFactory = new EscrowFactory(owner, treasury, arbiter, address(0), FEE_BPS);

        assertEq(nativeFactory.mosUSDC(), address(0));
        assertEq(nativeFactory.allowedToken(), address(0));
        assertTrue(nativeFactory.isNativePayment());
    }

    function testSetPaymentTokenAllowsSwitchingBetweenETHAndMosUSDC() public {
        vm.startPrank(owner);
        vm.expectEmit(true, true, false, true);
        emit AllowedTokenUpdated(address(token), address(0));
        vm.expectEmit(true, true, false, true);
        emit PaymentTokenUpdated(address(token), address(0));
        factory.setPaymentToken(address(0));

        assertEq(factory.allowedToken(), address(0));
        assertTrue(factory.isNativePayment());

        factory.setAllowedToken(address(token));
        vm.stopPrank();

        assertEq(factory.allowedToken(), address(token));
        assertEq(factory.mosUSDC(), address(token));
        assertFalse(factory.isNativePayment());
    }

    function testNativeFactoryCanRegisterMosUSDCOnce() public {
        EscrowFactory nativeFactory = new EscrowFactory(owner, treasury, arbiter, address(0), FEE_BPS);

        vm.prank(owner);
        vm.expectEmit(true, true, false, true);
        emit MosUSDCUpdated(address(0), address(token));
        nativeFactory.setPaymentToken(address(token));

        assertEq(nativeFactory.mosUSDC(), address(token));
        assertEq(nativeFactory.allowedToken(), address(token));
        assertFalse(nativeFactory.isNativePayment());
    }

    function testSetPaymentTokenRejectsDifferentMosUSDCAfterTrustedTokenIsSet() public {
        MosUSDC secondToken = new MosUSDC(owner, 0);

        vm.prank(owner);
        vm.expectRevert(EscrowErrors.TokenNotAllowed.selector);
        factory.setPaymentToken(address(secondToken));
    }

    function testCreateEscrowUsesMosUSDC() public {
        EscrowTypes.MilestoneInput[] memory milestones = new EscrowTypes.MilestoneInput[](1);
        milestones[0] = EscrowTypes.MilestoneInput({
            amount: TOTAL_AMOUNT, deadline: uint64(block.timestamp + 7 days), descriptionURI: "ipfs://milestone"
        });

        vm.prank(client);
        address escrowAddress = factory.createEscrow(contractor, address(0), TOTAL_AMOUNT, milestones, "ipfs://deal");

        Escrow escrow = Escrow(escrowAddress);
        assertEq(factory.mosUSDC(), address(token));
        assertEq(escrow.token(), address(token));
        assertEq(escrow.treasury(), address(factory));
        assertEq(address(escrow.mUSDC()), address(token));
        assertFalse(escrow.isNativePayment());
    }

    function testCreateEscrowCanPublishOpenDealWithoutContractor() public {
        EscrowTypes.MilestoneInput[] memory milestones = new EscrowTypes.MilestoneInput[](1);
        milestones[0] = EscrowTypes.MilestoneInput({
            amount: TOTAL_AMOUNT, deadline: uint64(block.timestamp + 7 days), descriptionURI: "ipfs://milestone"
        });

        vm.prank(client);
        address escrowAddress = factory.createEscrow(address(0), address(0), TOTAL_AMOUNT, milestones, "ipfs://open-deal");

        Escrow escrow = Escrow(escrowAddress);
        assertEq(escrow.client(), client);
        assertEq(escrow.contractor(), address(0));
        assertEq(escrow.treasury(), address(factory));
        assertEq(escrow.metadataURI(), "ipfs://open-deal");
    }

    function testCreateEscrowUsesNativeETH() public {
        EscrowFactory nativeFactory = new EscrowFactory(owner, treasury, arbiter, address(0), FEE_BPS);
        vm.prank(owner);
        nativeFactory.setTreasury(address(nativeFactory));
        EscrowTypes.MilestoneInput[] memory milestones = new EscrowTypes.MilestoneInput[](1);
        milestones[0] = EscrowTypes.MilestoneInput({
            amount: ETH_TOTAL_AMOUNT, deadline: uint64(block.timestamp + 7 days), descriptionURI: "ipfs://milestone"
        });

        vm.prank(client);
        address escrowAddress =
            nativeFactory.createEscrow(contractor, address(0), ETH_TOTAL_AMOUNT, milestones, "ipfs://native-deal");

        Escrow escrow = Escrow(escrowAddress);
        assertEq(escrow.token(), address(0));
        assertEq(escrow.treasury(), address(nativeFactory));
        assertEq(address(escrow.mUSDC()), address(0));
        assertTrue(escrow.isNativePayment());
    }

    function testOwnerCanWithdrawMosUSDCFees() public {
        Escrow escrow = Escrow(_createTokenEscrow());
        vm.prank(owner);
        token.mint(client, TOTAL_AMOUNT);

        vm.startPrank(client);
        token.approve(address(escrow), TOTAL_AMOUNT);
        escrow.fund();
        vm.stopPrank();

        vm.prank(contractor);
        escrow.acceptDeal();

        vm.prank(contractor);
        escrow.submitMilestone(0, "ipfs://result");

        vm.prank(client);
        escrow.approveMilestone(0);

        uint256 feeAmount = (TOTAL_AMOUNT * FEE_BPS) / 10_000;
        assertEq(token.balanceOf(address(factory)), feeAmount);

        vm.prank(owner);
        vm.expectEmit(true, true, false, true);
        emit FeesWithdrawn(address(token), owner, feeAmount);
        factory.withdrawFees(address(token));

        assertEq(token.balanceOf(address(factory)), 0);
        assertEq(token.balanceOf(owner), feeAmount);
    }

    function testOwnerCanWithdrawNativeFees() public {
        EscrowFactory nativeFactory = new EscrowFactory(owner, treasury, arbiter, address(0), FEE_BPS);
        vm.prank(owner);
        nativeFactory.setTreasury(address(nativeFactory));

        EscrowTypes.MilestoneInput[] memory milestones = new EscrowTypes.MilestoneInput[](1);
        milestones[0] = EscrowTypes.MilestoneInput({
            amount: ETH_TOTAL_AMOUNT, deadline: uint64(block.timestamp + 7 days), descriptionURI: "ipfs://milestone"
        });

        vm.prank(client);
        address escrowAddress =
            nativeFactory.createEscrow(contractor, address(0), ETH_TOTAL_AMOUNT, milestones, "ipfs://native-deal");
        Escrow escrow = Escrow(escrowAddress);

        vm.deal(client, ETH_TOTAL_AMOUNT);
        vm.prank(client);
        escrow.fund{value: ETH_TOTAL_AMOUNT}();

        vm.prank(contractor);
        escrow.acceptDeal();

        vm.prank(contractor);
        escrow.submitMilestone(0, "ipfs://result");

        vm.prank(client);
        escrow.approveMilestone(0);

        uint256 feeAmount = (ETH_TOTAL_AMOUNT * FEE_BPS) / 10_000;
        assertEq(address(nativeFactory).balance, feeAmount);

        uint256 ownerBalanceBefore = owner.balance;
        vm.prank(owner);
        nativeFactory.withdrawFees(address(0));

        assertEq(address(nativeFactory).balance, 0);
        assertEq(owner.balance, ownerBalanceBefore + feeAmount);
    }

    function _createTokenEscrow() internal returns (address escrowAddress) {
        EscrowTypes.MilestoneInput[] memory milestones = new EscrowTypes.MilestoneInput[](1);
        milestones[0] = EscrowTypes.MilestoneInput({
            amount: TOTAL_AMOUNT, deadline: uint64(block.timestamp + 7 days), descriptionURI: "ipfs://milestone"
        });

        vm.prank(client);
        escrowAddress = factory.createEscrow(contractor, address(0), TOTAL_AMOUNT, milestones, "ipfs://deal");
    }
}
