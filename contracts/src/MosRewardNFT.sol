// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155URIStorage.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract MosRewardNFT is ERC1155URIStorage, ERC1155Supply, ERC1155Holder, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable mUSDC;
    address public treasury;

    uint256 private _nextTokenId = 1;

    struct TokenInfo {
        uint256 primaryPrice;
        uint256 maxSupply;
        bool primarySaleActive;
        bool exists;
    }

    struct Listing {
        uint256 amount;
        uint256 pricePerUnit;
    }

    mapping(uint256 => TokenInfo) public tokenInfo;
    mapping(address => mapping(uint256 => Listing)) public listings;

    event TokenCreated(
        uint256 indexed tokenId,
        string tokenURI,
        uint256 primaryPrice,
        uint256 maxSupply,
        bool primarySaleActive
    );

    event UserRewarded(
        address indexed to,
        uint256 indexed tokenId,
        uint256 amount
    );

    event PrimarySalePurchased(
        address indexed buyer,
        uint256 indexed tokenId,
        uint256 amount,
        uint256 totalCost
    );

    event ListedForSale(
        address indexed seller,
        uint256 indexed tokenId,
        uint256 amount,
        uint256 pricePerUnit
    );

    event ListingCancelled(
        address indexed seller,
        uint256 indexed tokenId,
        uint256 amount
    );

    event SecondarySalePurchased(
        address indexed buyer,
        address indexed seller,
        uint256 indexed tokenId,
        uint256 amount,
        uint256 totalCost
    );

    event PrimaryPriceUpdated(uint256 indexed tokenId, uint256 oldPrice, uint256 newPrice);
    event PrimarySaleStatusUpdated(uint256 indexed tokenId, bool active);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event TokenURIUpdated(uint256 indexed tokenId, string newTokenURI);

    constructor(
        address initialOwner,
        address mUSDCAddress,
        address treasury_
    ) ERC1155("") Ownable(initialOwner) {
        require(mUSDCAddress != address(0), "Invalid mUSDC address");
        require(treasury_ != address(0), "Invalid treasury");

        mUSDC = IERC20(mUSDCAddress);
        treasury = treasury_;
    }

    function createToken(
        string memory tokenURI,
        uint256 primaryPrice,
        uint256 maxSupply,
        bool primarySaleActive
    ) external onlyOwner returns (uint256) {
        require(bytes(tokenURI).length > 0, "Empty token URI");
        require(maxSupply > 0, "Max supply must be > 0");

        uint256 tokenId = _nextTokenId;
        _nextTokenId++;

        tokenInfo[tokenId] = TokenInfo({
            primaryPrice: primaryPrice,
            maxSupply: maxSupply,
            primarySaleActive: primarySaleActive,
            exists: true
        });

        _setURI(tokenId, tokenURI);

        emit TokenCreated(tokenId, tokenURI, primaryPrice, maxSupply, primarySaleActive);

        return tokenId;
    }

    function rewardUser(address to, uint256 tokenId, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be > 0");
        require(tokenInfo[tokenId].exists, "Token does not exist");
        require(totalSupply(tokenId) + amount <= tokenInfo[tokenId].maxSupply, "Exceeds max supply");

        _mint(to, tokenId, amount, "");

        emit UserRewarded(to, tokenId, amount);
    }

    function buyFromPlatform(uint256 tokenId, uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(tokenInfo[tokenId].exists, "Token does not exist");

        TokenInfo memory info = tokenInfo[tokenId];

        require(info.primarySaleActive, "Primary sale inactive");
        require(info.primaryPrice > 0, "Primary price not set");
        require(totalSupply(tokenId) + amount <= info.maxSupply, "Exceeds max supply");

        uint256 totalCost = info.primaryPrice * amount;

        mUSDC.safeTransferFrom(msg.sender, treasury, totalCost);
        _mint(msg.sender, tokenId, amount, "");

        emit PrimarySalePurchased(msg.sender, tokenId, amount, totalCost);
    }

    function listForSale(uint256 tokenId, uint256 amount, uint256 pricePerUnit) external nonReentrant {
        require(tokenInfo[tokenId].exists, "Token does not exist");
        require(amount > 0, "Amount must be > 0");
        require(pricePerUnit > 0, "Price must be > 0");
        require(balanceOf(msg.sender, tokenId) >= amount, "Insufficient balance");
        require(listings[msg.sender][tokenId].amount == 0, "Listing already exists");

        _safeTransferFrom(msg.sender, address(this), tokenId, amount, "");

        listings[msg.sender][tokenId] = Listing({
            amount: amount,
            pricePerUnit: pricePerUnit
        });

        emit ListedForSale(msg.sender, tokenId, amount, pricePerUnit);
    }

    function cancelListing(uint256 tokenId) external nonReentrant {
        Listing memory listing = listings[msg.sender][tokenId];
        require(listing.amount > 0, "Listing does not exist");

        delete listings[msg.sender][tokenId];

        _safeTransferFrom(address(this), msg.sender, tokenId, listing.amount, "");

        emit ListingCancelled(msg.sender, tokenId, listing.amount);
    }

    function buyFromUser(address seller, uint256 tokenId, uint256 amount) external nonReentrant {
        require(seller != address(0), "Invalid seller");
        require(seller != msg.sender, "Cannot buy own listing");
        require(amount > 0, "Amount must be > 0");

        Listing storage listing = listings[seller][tokenId];
        require(listing.amount >= amount, "Not enough listed amount");

        uint256 totalCost = listing.pricePerUnit * amount;

        listing.amount -= amount;
        if (listing.amount == 0) {
            delete listings[seller][tokenId];
        }

        mUSDC.safeTransferFrom(msg.sender, seller, totalCost);
        _safeTransferFrom(address(this), msg.sender, tokenId, amount, "");

        emit SecondarySalePurchased(msg.sender, seller, tokenId, amount, totalCost);
    }

    function setPrimaryPrice(uint256 tokenId, uint256 newPrice) external onlyOwner {
        require(tokenInfo[tokenId].exists, "Token does not exist");

        uint256 oldPrice = tokenInfo[tokenId].primaryPrice;
        tokenInfo[tokenId].primaryPrice = newPrice;

        emit PrimaryPriceUpdated(tokenId, oldPrice, newPrice);
    }

    function setPrimarySaleActive(uint256 tokenId, bool active) external onlyOwner {
        require(tokenInfo[tokenId].exists, "Token does not exist");

        tokenInfo[tokenId].primarySaleActive = active;

        emit PrimarySaleStatusUpdated(tokenId, active);
    }

    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury");

        address oldTreasury = treasury;
        treasury = newTreasury;

        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    function setTokenURI(uint256 tokenId, string memory newTokenURI) external onlyOwner {
        require(tokenInfo[tokenId].exists, "Token does not exist");
        require(bytes(newTokenURI).length > 0, "Empty token URI");

        _setURI(tokenId, newTokenURI);

        emit TokenURIUpdated(tokenId, newTokenURI);
    }

    function safeTransferFrom(
        address,
        address,
        uint256,
        uint256,
        bytes memory
    ) public pure override {
        revert("Direct transfer disabled");
    }

    function safeBatchTransferFrom(
        address,
        address,
        uint256[] memory,
        uint256[] memory,
        bytes memory
    ) public pure override {
        revert("Direct batch transfer disabled");
    }

    function burn(address from, uint256 tokenId, uint256 amount) external {
        require(tokenInfo[tokenId].exists, "Token does not exist");
        require(amount > 0, "Amount must be > 0");
        require(
            from == msg.sender || isApprovedForAll(from, msg.sender),
            "Not owner nor approved"
        );

        _burn(from, tokenId, amount);
    }

    function tokenExists(uint256 tokenId) external view returns (bool) {
        return tokenInfo[tokenId].exists;
    }

    function uri(uint256 tokenId)
        public
        view
        override(ERC1155, ERC1155URIStorage)
        returns (string memory)
    {
        return super.uri(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, ERC1155Holder)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override(ERC1155, ERC1155Supply) {
        super._update(from, to, ids, values);
    }
}
