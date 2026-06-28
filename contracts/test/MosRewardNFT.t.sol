// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {MosRewardNFT} from "../src/MosRewardNFT.sol";
import {MosUSDC} from "../src/MosUSDC.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MosRewardNFTTest is Test {
    MosRewardNFT nft;
    MosUSDC musdc;

    address owner = makeAddr("owner");
    address user1 = makeAddr("user1");
    address user2 = makeAddr("user2");
    address treasury = makeAddr("treasury");

    uint256 constant INITIAL_SUPPLY = 1_000_000 * 10 ** 6;
    uint256 constant USER_FUNDS = 1_000 * 10 ** 6;

    function _uri1() internal pure returns (string memory) {
        return "ipfs://reward-1.json";
    }

    function setUp() public {
        musdc = new MosUSDC(owner, INITIAL_SUPPLY);
        nft = new MosRewardNFT(owner, address(musdc), treasury);

        vm.prank(owner);
        musdc.transfer(user1, USER_FUNDS);

        vm.prank(owner);
        musdc.transfer(user2, USER_FUNDS);
    }

    function _createToken(uint256 price, uint256 maxSupply, bool active) internal returns (uint256) {
        vm.prank(owner);
        return nft.createToken(_uri1(), price, maxSupply, active);
    }

    function test_Constructor_SetsValues() public view {
        assertEq(nft.owner(), owner);
        assertEq(address(nft.mUSDC()), address(musdc));
        assertEq(nft.treasury(), treasury);
    }

    function test_CreateToken_ByOwner() public {
        uint256 tokenId = _createToken(50 * 10 ** 6, 10, true);

        assertEq(tokenId, 1);

        (uint256 price, uint256 maxSupply, bool active, bool exists) = nft.tokenInfo(tokenId);
        assertEq(price, 50 * 10 ** 6);
        assertEq(maxSupply, 10);
        assertEq(active, true);
        assertEq(exists, true);
        assertEq(nft.uri(tokenId), _uri1());
    }

    function test_CreateToken_RevertsForNonOwner() public {
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, user1));
        nft.createToken(_uri1(), 50 * 10 ** 6, 10, true);
    }

    function test_RewardUser_MintsNFT() public {
        uint256 tokenId = _createToken(50 * 10 ** 6, 10, true);

        vm.prank(owner);
        nft.rewardUser(user1, tokenId, 2);

        assertEq(nft.balanceOf(user1, tokenId), 2);
        assertEq(nft.totalSupply(tokenId), 2);
    }

    function test_RewardUser_RevertsIfExceedsMaxSupply() public {
        uint256 tokenId = _createToken(50 * 10 ** 6, 1, true);

        vm.prank(owner);
        nft.rewardUser(user1, tokenId, 1);

        vm.prank(owner);
        vm.expectRevert(bytes("Exceeds max supply"));
        nft.rewardUser(user2, tokenId, 1);
    }

    function test_BuyFromPlatform_OnlyForMUSDC() public {
        uint256 tokenId = _createToken(50 * 10 ** 6, 10, true);

        vm.prank(user1);
        musdc.approve(address(nft), 100 * 10 ** 6);

        uint256 treasuryBefore = musdc.balanceOf(treasury);
        uint256 userBefore = musdc.balanceOf(user1);

        vm.prank(user1);
        nft.buyFromPlatform(tokenId, 2);

        assertEq(nft.balanceOf(user1, tokenId), 2);
        assertEq(nft.totalSupply(tokenId), 2);
        assertEq(musdc.balanceOf(treasury), treasuryBefore + 100 * 10 ** 6);
        assertEq(musdc.balanceOf(user1), userBefore - 100 * 10 ** 6);
    }

    function test_BuyFromPlatform_RevertsIfSaleInactive() public {
        uint256 tokenId = _createToken(50 * 10 ** 6, 10, false);

        vm.prank(user1);
        musdc.approve(address(nft), 50 * 10 ** 6);

        vm.prank(user1);
        vm.expectRevert(bytes("Primary sale inactive"));
        nft.buyFromPlatform(tokenId, 1);
    }

    function test_BuyFromPlatform_RevertsWithoutAllowance() public {
        uint256 tokenId = _createToken(50 * 10 ** 6, 10, true);

        vm.prank(user1);
        vm.expectRevert();
        nft.buyFromPlatform(tokenId, 1);
    }

    function test_ListForSale_MovesNFTToContract() public {
        uint256 tokenId = _createToken(50 * 10 ** 6, 10, true);

        vm.prank(owner);
        nft.rewardUser(user1, tokenId, 2);

        vm.prank(user1);
        nft.listForSale(tokenId, 2, 30 * 10 ** 6);

        (uint256 amount, uint256 pricePerUnit) = nft.listings(user1, tokenId);

        assertEq(amount, 2);
        assertEq(pricePerUnit, 30 * 10 ** 6);
        assertEq(nft.balanceOf(user1, tokenId), 0);
        assertEq(nft.balanceOf(address(nft), tokenId), 2);
    }

    function test_CancelListing_ReturnsNFTToSeller() public {
        uint256 tokenId = _createToken(50 * 10 ** 6, 10, true);

        vm.prank(owner);
        nft.rewardUser(user1, tokenId, 2);

        vm.prank(user1);
        nft.listForSale(tokenId, 2, 30 * 10 ** 6);

        vm.prank(user1);
        nft.cancelListing(tokenId);

        (uint256 amount, uint256 pricePerUnit) = nft.listings(user1, tokenId);

        assertEq(amount, 0);
        assertEq(pricePerUnit, 0);
        assertEq(nft.balanceOf(user1, tokenId), 2);
        assertEq(nft.balanceOf(address(nft), tokenId), 0);
    }

    function test_BuyFromUser_TransfersMUSDCToSellerAndNFTToBuyer() public {
        uint256 tokenId = _createToken(50 * 10 ** 6, 10, true);

        vm.prank(owner);
        nft.rewardUser(user1, tokenId, 2);

        vm.prank(user1);
        nft.listForSale(tokenId, 2, 25 * 10 ** 6);

        vm.prank(user2);
        musdc.approve(address(nft), 25 * 10 ** 6);

        uint256 sellerBefore = musdc.balanceOf(user1);
        uint256 buyerBefore = musdc.balanceOf(user2);

        vm.prank(user2);
        nft.buyFromUser(user1, tokenId, 1);

        (uint256 amount,) = nft.listings(user1, tokenId);

        assertEq(amount, 1);
        assertEq(nft.balanceOf(user2, tokenId), 1);
        assertEq(nft.balanceOf(address(nft), tokenId), 1);
        assertEq(musdc.balanceOf(user1), sellerBefore + 25 * 10 ** 6);
        assertEq(musdc.balanceOf(user2), buyerBefore - 25 * 10 ** 6);
    }

    function test_BuyFromUser_RevertsIfBuyerIsSeller() public {
        uint256 tokenId = _createToken(50 * 10 ** 6, 10, true);

        vm.prank(owner);
        nft.rewardUser(user1, tokenId, 1);

        vm.prank(user1);
        nft.listForSale(tokenId, 1, 20 * 10 ** 6);

        vm.prank(user1);
        vm.expectRevert(bytes("Cannot buy own listing"));
        nft.buyFromUser(user1, tokenId, 1);
    }

    function test_DirectTransfer_Disabled() public {
        uint256 tokenId = _createToken(50 * 10 ** 6, 10, true);

        vm.prank(owner);
        nft.rewardUser(user1, tokenId, 1);

        vm.prank(user1);
        vm.expectRevert(bytes("Direct transfer disabled"));
        nft.safeTransferFrom(user1, user2, tokenId, 1, "");
    }

    function test_Burn_WorksForOwnerOfNFT() public {
        uint256 tokenId = _createToken(50 * 10 ** 6, 10, true);

        vm.prank(owner);
        nft.rewardUser(user1, tokenId, 2);

        vm.prank(user1);
        nft.burn(user1, tokenId, 1);

        assertEq(nft.balanceOf(user1, tokenId), 1);
        assertEq(nft.totalSupply(tokenId), 1);
    }
}
