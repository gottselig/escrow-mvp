// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Escrow} from "./Escrow.sol";
import {PaymentTokenValidation} from "./libraries/PaymentTokenValidation.sol";
import {EscrowTypes} from "./libraries/EscrowTypes.sol";
import {EscrowErrors} from "./common/EscrowErrors.sol";

contract EscrowFactory is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =============================================================
    //                            EVENTS
    // =============================================================

    event EscrowCreated(
        address indexed escrow,
        address indexed client,
        address indexed contractor,
        address arbiter,
        address token,
        uint256 totalAmount,
        string metadataURI
    );

    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event DefaultArbiterUpdated(address indexed oldArbiter, address indexed newArbiter);
    event FeeBpsUpdated(uint96 oldFeeBps, uint96 newFeeBps);
    event AllowedTokenUpdated(address indexed oldToken, address indexed newToken);
    event PaymentTokenUpdated(address indexed oldToken, address indexed newToken);
    event MosUSDCUpdated(address indexed oldToken, address indexed newToken);
    event FeesWithdrawn(address indexed token, address indexed recipient, uint256 amount);

    // =============================================================
    //                            STORAGE
    // =============================================================

    address public treasury;
    address public defaultArbiter;
    address public mosUSDC;
    address public allowedToken;
    uint96 public feeBps;

    address[] private _allEscrows;
    mapping(address => bool) public isEscrow;

    // =============================================================
    //                         CONSTRUCTOR
    // =============================================================

    constructor(address initialOwner, address _treasury, address _defaultArbiter, address _allowedToken, uint96 _feeBps)
        Ownable(initialOwner)
    {
        if (initialOwner == address(0)) revert EscrowErrors.ZeroAddress();
        if (_treasury == address(0)) revert EscrowErrors.ZeroAddress();
        if (_defaultArbiter == address(0)) revert EscrowErrors.ZeroAddress();
        if (_feeBps > 10_000) revert EscrowErrors.InvalidFeeBps();
        PaymentTokenValidation.requireEthOrMosUsdc(_allowedToken);

        treasury = _treasury;
        defaultArbiter = _defaultArbiter;
        mosUSDC = _allowedToken;
        allowedToken = _allowedToken;
        feeBps = _feeBps;
    }

    // =============================================================
    //                      ADMIN CONFIGURATION
    // =============================================================

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert EscrowErrors.ZeroAddress();

        address oldTreasury = treasury;
        treasury = newTreasury;

        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    function setDefaultArbiter(address newArbiter) external onlyOwner {
        if (newArbiter == address(0)) revert EscrowErrors.ZeroAddress();

        address oldArbiter = defaultArbiter;
        defaultArbiter = newArbiter;

        emit DefaultArbiterUpdated(oldArbiter, newArbiter);
    }

    function setFeeBps(uint96 newFeeBps) external onlyOwner {
        if (newFeeBps > 10_000) revert EscrowErrors.InvalidFeeBps();

        uint96 oldFeeBps = feeBps;
        feeBps = newFeeBps;

        emit FeeBpsUpdated(oldFeeBps, newFeeBps);
    }

    function setAllowedToken(address newToken) external onlyOwner {
        _setPaymentToken(newToken);
    }

    function setPaymentToken(address newToken) external onlyOwner {
        _setPaymentToken(newToken);
    }

    function isNativePayment() external view returns (bool) {
        return allowedToken == address(0);
    }

    function withdrawFees(address paymentToken) external onlyOwner nonReentrant returns (uint256 amount) {
        amount = feeBalance(paymentToken);
        if (amount == 0) revert EscrowErrors.ZeroAmount();

        address recipient = owner();
        if (paymentToken == address(0)) {
            (bool success,) = payable(recipient).call{value: amount}("");
            if (!success) revert EscrowErrors.NativeTransferFailed();
        } else {
            IERC20(paymentToken).safeTransfer(recipient, amount);
        }

        emit FeesWithdrawn(paymentToken, recipient, amount);
    }

    function _setPaymentToken(address newToken) internal {
        PaymentTokenValidation.requireEthOrMosUsdc(newToken);
        if (newToken != address(0)) {
            if (mosUSDC == address(0)) {
                mosUSDC = newToken;
                emit MosUSDCUpdated(address(0), newToken);
            } else if (newToken != mosUSDC) {
                revert EscrowErrors.TokenNotAllowed();
            }
        }

        address oldToken = allowedToken;
        allowedToken = newToken;

        emit AllowedTokenUpdated(oldToken, newToken);
        emit PaymentTokenUpdated(oldToken, newToken);
    }

    // =============================================================
    //                         CORE FUNCTION
    // =============================================================

    function createEscrow(
        address contractor,
        address arbiter,
        uint256 totalAmount,
        EscrowTypes.MilestoneInput[] calldata milestones,
        string calldata metadataURI
    ) external returns (address escrow) {
        if (totalAmount == 0) revert EscrowErrors.ZeroAmount();
        if (milestones.length == 0) revert EscrowErrors.InvalidMilestones();

        uint256 totalMilestonesAmount;
        for (uint256 i = 0; i < milestones.length; i++) {
            if (milestones[i].amount == 0) revert EscrowErrors.ZeroAmount();
            totalMilestonesAmount += milestones[i].amount;
        }

        if (totalMilestonesAmount != totalAmount) revert EscrowErrors.InvalidMilestones();

        address finalArbiter = arbiter == address(0) ? defaultArbiter : arbiter;

        Escrow instance = new Escrow(
            msg.sender, contractor, finalArbiter, allowedToken, treasury, totalAmount, feeBps, metadataURI, milestones
        );

        escrow = address(instance);
        _allEscrows.push(escrow);
        isEscrow[escrow] = true;

        emit EscrowCreated(escrow, msg.sender, contractor, finalArbiter, allowedToken, totalAmount, metadataURI);
    }

    // =============================================================
    //                            GETTERS
    // =============================================================

    function getEscrowsCount() external view returns (uint256) {
        return _allEscrows.length;
    }

    function getEscrowAt(uint256 index) external view returns (address) {
        return _allEscrows[index];
    }

    function getAllEscrows() external view returns (address[] memory) {
        return _allEscrows;
    }

    function feeBalance(address paymentToken) public view returns (uint256) {
        if (paymentToken == address(0)) {
            return address(this).balance;
        }

        return IERC20(paymentToken).balanceOf(address(this));
    }

    receive() external payable {}
}
