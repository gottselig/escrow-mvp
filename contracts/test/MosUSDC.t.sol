// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {MosUSDC} from "../src/MosUSDC.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MosUSDCTest is Test {
    MosUSDC token;

    address owner = makeAddr("owner");
    address user1 = makeAddr("user1");
    address user2 = makeAddr("user2");

    uint256 constant INITIAL_SUPPLY = 1_000_000 * 10 ** 6; // 1,000,000 mUSDC
    uint256 constant MINT_AMOUNT = 5_000 * 10 ** 6; // 5,000 mUSDC
    uint256 constant BURN_AMOUNT = 1_000 * 10 ** 6; // 1,000 mUSDC
    uint256 constant TRANSFER_AMOUNT = 250 * 10 ** 6; // 250 mUSDC

    function setUp() public {
        token = new MosUSDC(owner, INITIAL_SUPPLY);
    }

    function test_NameAndSymbol() public view {
        assertEq(token.name(), "MosUSDC");
        assertEq(token.symbol(), "mUSDC");
    }

    function test_DecimalsIsSix() public view {
        assertEq(token.decimals(), 6);
    }

    function test_InitialSupplyMintedToOwner() public view {
        assertEq(token.totalSupply(), INITIAL_SUPPLY);
        assertEq(token.balanceOf(owner), INITIAL_SUPPLY);
    }

    function test_OwnerCanMint() public {
        vm.prank(owner);
        token.mint(user1, MINT_AMOUNT);

        assertEq(token.balanceOf(user1), MINT_AMOUNT);
        assertEq(token.totalSupply(), INITIAL_SUPPLY + MINT_AMOUNT);
    }

    function test_NonOwnerCannotMint() public {
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, user1));
        token.mint(user1, MINT_AMOUNT);
    }

    function test_OwnerCanBurn() public {
        vm.prank(owner);
        token.mint(user1, MINT_AMOUNT);

        vm.prank(owner);
        token.burn(user1, BURN_AMOUNT);

        assertEq(token.balanceOf(user1), MINT_AMOUNT - BURN_AMOUNT);
        assertEq(token.totalSupply(), INITIAL_SUPPLY + MINT_AMOUNT - BURN_AMOUNT);
    }

    function test_NonOwnerCannotBurn() public {
        vm.prank(owner);
        token.mint(user1, MINT_AMOUNT);

        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, user1));
        token.burn(user1, BURN_AMOUNT);
    }

    function test_TransferWorks() public {
        vm.prank(owner);
        token.transfer(user1, TRANSFER_AMOUNT);

        assertEq(token.balanceOf(user1), TRANSFER_AMOUNT);
        assertEq(token.balanceOf(owner), INITIAL_SUPPLY - TRANSFER_AMOUNT);
    }

    function test_ApproveAndTransferFromWorks() public {
        vm.prank(owner);
        token.approve(user1, TRANSFER_AMOUNT);

        vm.prank(user1);
        token.transferFrom(owner, user2, TRANSFER_AMOUNT);

        assertEq(token.balanceOf(user2), TRANSFER_AMOUNT);
        assertEq(token.balanceOf(owner), INITIAL_SUPPLY - TRANSFER_AMOUNT);
        assertEq(token.allowance(owner, user1), 0);
    }

    function testFuzz_Transfer(uint96 amount) public {
        amount = uint96(bound(amount, 0, uint96(INITIAL_SUPPLY)));

        vm.prank(owner);
        token.transfer(user1, amount);

        assertEq(token.balanceOf(user1), amount);
        assertEq(token.balanceOf(owner), INITIAL_SUPPLY - amount);
    }
}
