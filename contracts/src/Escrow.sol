// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {MosUSDC} from "./MosUSDC.sol";
import {PaymentTokenValidation} from "./libraries/PaymentTokenValidation.sol";
import {EscrowTypes} from "./libraries/EscrowTypes.sol";
import {EscrowErrors} from "./common/EscrowErrors.sol";

contract Escrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // =============================================================
    //                            EVENTS
    // =============================================================

    event DealAccepted(address indexed contractor);
    event DealFunded(address indexed client, uint256 amount);
    event DealCancelled(address indexed client);
    event DealUpdated(uint256 totalAmount, string metadataURI);

    event MilestoneSubmitted(uint256 indexed milestoneId, string resultURI);

    event MilestoneApproved(uint256 indexed milestoneId, uint256 grossAmount, uint256 feeAmount, uint256 netAmount);

    event DisputeOpened(address indexed openedBy, string reasonURI);
    event DisputeResolvedToClient(uint256 amount);
    event DisputeResolvedToContractor(uint256 amount);
    event DisputeResolvedSplit(uint256 clientAmount, uint256 contractorAmount);

    event StatusChanged(EscrowTypes.DealStatus oldStatus, EscrowTypes.DealStatus newStatus);

    // =============================================================
    //                            STORAGE
    // =============================================================

    address public immutable client;
    address public contractor;
    address public immutable arbiter;
    address public immutable token;
    MosUSDC public immutable mUSDC;
    bool public immutable isNativePayment;
    address public immutable treasury;

    uint256 public totalAmount;
    uint96 public immutable feeBps;

    uint256 public fundedAmount;
    uint256 public releasedAmount;

    string public metadataURI;
    string public disputeReasonURI;

    EscrowTypes.DealStatus public status;
    EscrowTypes.Milestone[] internal _milestones;

    // =============================================================
    //                           MODIFIERS
    // =============================================================

    modifier onlyClient() {
        _onlyClient();
        _;
    }

    function _onlyClient() internal view {
        if (msg.sender != client) revert EscrowErrors.NotClient();
    }

    modifier onlyContractor() {
        _onlyContractor();
        _;
    }

    function _onlyContractor() internal view {
        if (msg.sender == client) revert EscrowErrors.NotContractor();
        if (msg.sender == treasury) revert EscrowErrors.TreasuryCannotActAsContractor();
        if (contractor != address(0) && msg.sender != contractor) revert EscrowErrors.NotContractor();
    }

    modifier onlyArbiter() {
        _onlyArbiter();
        _;
    }

    function _onlyArbiter() internal view {
        if (msg.sender != arbiter) revert EscrowErrors.NotArbiter();
    }

    modifier onlyParticipant() {
        _onlyParticipant();
        _;
    }

    function _onlyParticipant() internal view {
        if (msg.sender != client && msg.sender != contractor) {
            revert EscrowErrors.NotParticipant();
        }
    }

    modifier onlyStatus(EscrowTypes.DealStatus expected) {
        _onlyStatus(expected);
        _;
    }

    function _onlyStatus(EscrowTypes.DealStatus expected) internal view {
        if (status != expected) revert EscrowErrors.InvalidStatus();
    }

    modifier milestoneExists(uint256 milestoneId) {
        _milestoneExists(milestoneId);
        _;
    }

    function _milestoneExists(uint256 milestoneId) internal view {
        if (milestoneId >= _milestones.length) revert EscrowErrors.InvalidMilestoneId();
    }

    // =============================================================
    //                         CONSTRUCTOR
    // =============================================================

    constructor(
        address _client,
        address _contractor,
        address _arbiter,
        address _paymentToken,
        address _treasury,
        uint256 _totalAmount,
        uint96 _feeBps,
        string memory _metadataURI,
        EscrowTypes.MilestoneInput[] memory milestoneInputs
    ) {
        if (_client == address(0)) revert EscrowErrors.ZeroAddress();
        if (_arbiter == address(0)) revert EscrowErrors.ZeroAddress();
        if (_treasury == address(0)) revert EscrowErrors.ZeroAddress();
        if (_totalAmount == 0) revert EscrowErrors.ZeroAmount();
        if (_feeBps > 10_000) revert EscrowErrors.InvalidFeeBps();
        if (milestoneInputs.length == 0) revert EscrowErrors.InvalidMilestones();
        PaymentTokenValidation.requireEthOrMosUsdc(_paymentToken);

        client = _client;
        contractor = _contractor;
        arbiter = _arbiter;
        token = _paymentToken;
        mUSDC = MosUSDC(_paymentToken);
        isNativePayment = _paymentToken == address(0);
        treasury = _treasury;
        totalAmount = _totalAmount;
        feeBps = _feeBps;
        metadataURI = _metadataURI;
        status = EscrowTypes.DealStatus.Created;

        _storeMilestones(milestoneInputs, _totalAmount);
    }

    function _storeMilestones(EscrowTypes.MilestoneInput[] memory milestoneInputs, uint256 expectedTotalAmount) internal {
        uint256 milestonesSum;
        for (uint256 i = 0; i < milestoneInputs.length; i++) {
            if (milestoneInputs[i].amount == 0) revert EscrowErrors.ZeroAmount();

            milestonesSum += milestoneInputs[i].amount;

            _milestones.push(
                EscrowTypes.Milestone({
                    amount: milestoneInputs[i].amount,
                    deadline: milestoneInputs[i].deadline,
                    status: EscrowTypes.MilestoneStatus.Pending,
                    descriptionURI: milestoneInputs[i].descriptionURI,
                    resultURI: ""
                })
            );
        }

        if (milestonesSum != expectedTotalAmount) revert EscrowErrors.InvalidMilestones();
    }

    // =============================================================
    //                      EXTERNAL CORE ACTIONS
    // =============================================================

    function acceptDeal() external onlyContractor {
        if (status != EscrowTypes.DealStatus.Funded) {
            revert EscrowErrors.InvalidStatus();
        }

        if (contractor == address(0)) {
            contractor = msg.sender;
        }

        _setStatus(EscrowTypes.DealStatus.InProgress);
        emit DealAccepted(msg.sender);
    }

    function updateDeal(
        uint256 newTotalAmount,
        EscrowTypes.MilestoneInput[] calldata milestoneInputs,
        string calldata newMetadataURI
    ) external onlyStatus(EscrowTypes.DealStatus.Created) {
        if (msg.sender != client && msg.sender != arbiter) revert EscrowErrors.NotAuthorized();
        if (contractor != address(0)) revert EscrowErrors.AlreadyAccepted();
        if (fundedAmount != 0) revert EscrowErrors.AlreadyFunded();
        if (newTotalAmount == 0) revert EscrowErrors.ZeroAmount();
        if (milestoneInputs.length == 0) revert EscrowErrors.InvalidMilestones();

        totalAmount = newTotalAmount;
        metadataURI = newMetadataURI;
        delete _milestones;
        _storeMilestones(milestoneInputs, newTotalAmount);

        emit DealUpdated(newTotalAmount, newMetadataURI);
    }

    function fund() external payable onlyClient nonReentrant {
        if (fundedAmount != 0) revert EscrowErrors.AlreadyFunded();

        EscrowTypes.DealStatus currentStatus = status;
        if (currentStatus != EscrowTypes.DealStatus.Created && currentStatus != EscrowTypes.DealStatus.Accepted) {
            revert EscrowErrors.InvalidStatus();
        }

        fundedAmount = totalAmount;
        if (isNativePayment) {
            if (msg.value != totalAmount) revert EscrowErrors.InvalidNativeAmount();
        } else {
            if (msg.value != 0) revert EscrowErrors.InvalidNativeAmount();
            _escrowToken().safeTransferFrom(client, address(this), totalAmount);
        }

        if (currentStatus == EscrowTypes.DealStatus.Accepted) {
            _setStatus(EscrowTypes.DealStatus.InProgress);
        } else {
            _setStatus(EscrowTypes.DealStatus.Funded);
        }

        emit DealFunded(msg.sender, totalAmount);
    }

    function cancelBeforeFunding() external {
        if (msg.sender != client && msg.sender != arbiter) revert EscrowErrors.NotAuthorized();
        if (msg.sender == arbiter) {
            // Arbiter can only cancel before any funding
            if (status != EscrowTypes.DealStatus.Created) revert EscrowErrors.InvalidStatus();
        } else {
            // Client can cancel in Created or Funded status
            if (status != EscrowTypes.DealStatus.Created && status != EscrowTypes.DealStatus.Funded) {
                revert EscrowErrors.InvalidStatus();
            }
        }

        uint256 refundAmount = remainingBalance();
        releasedAmount += refundAmount;
        _setStatus(EscrowTypes.DealStatus.Cancelled);

        if (refundAmount > 0) {
            _transferPayment(client, refundAmount);
        }

        emit DealCancelled(msg.sender);
    }

    function submitMilestone(uint256 milestoneId, string calldata resultURI)
        external
        onlyContractor
        milestoneExists(milestoneId)
    {
        if (status != EscrowTypes.DealStatus.InProgress) {
            revert EscrowErrors.InvalidStatus();
        }

        if (milestoneId != currentMilestoneId()) {
            revert EscrowErrors.InvalidMilestoneId();
        }

        EscrowTypes.Milestone storage milestone = _milestones[milestoneId];
        if (milestone.status != EscrowTypes.MilestoneStatus.Pending) {
            revert EscrowErrors.MilestoneNotPending();
        }

        milestone.resultURI = resultURI;
        milestone.status = EscrowTypes.MilestoneStatus.Submitted;

        emit MilestoneSubmitted(milestoneId, resultURI);
    }

    function approveMilestone(uint256 milestoneId) external onlyClient nonReentrant milestoneExists(milestoneId) {
        if (status != EscrowTypes.DealStatus.InProgress) {
            revert EscrowErrors.InvalidStatus();
        }

        if (milestoneId != currentMilestoneId()) {
            revert EscrowErrors.InvalidMilestoneId();
        }

        EscrowTypes.Milestone storage milestone = _milestones[milestoneId];
        if (milestone.status != EscrowTypes.MilestoneStatus.Submitted) {
            revert EscrowErrors.MilestoneNotSubmitted();
        }

        _releaseMilestone(milestoneId);

        if (allMilestonesApproved()) {
            _setStatus(EscrowTypes.DealStatus.Completed);
        }
    }

    function openDispute(string calldata reasonURI) external onlyParticipant {
        if (status != EscrowTypes.DealStatus.Funded && status != EscrowTypes.DealStatus.InProgress) {
            revert EscrowErrors.InvalidStatus();
        }

        disputeReasonURI = reasonURI;
        _setStatus(EscrowTypes.DealStatus.Disputed);

        emit DisputeOpened(msg.sender, reasonURI);
    }

    function resolveToClient() external onlyArbiter nonReentrant onlyStatus(EscrowTypes.DealStatus.Disputed) {
        uint256 remaining = remainingBalance();

        releasedAmount += remaining;
        _setStatus(EscrowTypes.DealStatus.Resolved);

        if (remaining > 0) {
            _transferPayment(client, remaining);
        }

        emit DisputeResolvedToClient(remaining);
    }

    function resolveToContractor() external onlyArbiter nonReentrant onlyStatus(EscrowTypes.DealStatus.Disputed) {
        if (contractor == address(0)) revert EscrowErrors.ContractorNotAssigned();

        uint256 remaining = remainingBalance();
        uint256 feeAmount = _feeAmount(remaining);
        uint256 netAmount = remaining - feeAmount;

        releasedAmount += remaining;
        _setStatus(EscrowTypes.DealStatus.Resolved);

        if (feeAmount > 0) {
            _transferPayment(treasury, feeAmount);
        }

        if (netAmount > 0) {
            _transferPayment(contractor, netAmount);
        }

        emit DisputeResolvedToContractor(remaining);
    }

    function resolveSplit(uint256 clientAmount, uint256 contractorAmount)
        external
        onlyArbiter
        nonReentrant
        onlyStatus(EscrowTypes.DealStatus.Disputed)
    {
        if (contractorAmount > 0 && contractor == address(0)) revert EscrowErrors.ContractorNotAssigned();

        uint256 remaining = remainingBalance();
        uint256 totalDistributed = clientAmount + contractorAmount;

        // В MVP распределяем весь остаток полностью
        if (totalDistributed != remaining) {
            revert EscrowErrors.DistributionExceedsBalance();
        }

        uint256 feeAmount = _feeAmount(contractorAmount);
        uint256 contractorNet = contractorAmount - feeAmount;

        releasedAmount += totalDistributed;
        _setStatus(EscrowTypes.DealStatus.Resolved);

        if (clientAmount > 0) {
            _transferPayment(client, clientAmount);
        }

        if (feeAmount > 0) {
            _transferPayment(treasury, feeAmount);
        }

        if (contractorNet > 0) {
            _transferPayment(contractor, contractorNet);
        }

        emit DisputeResolvedSplit(clientAmount, contractorAmount);
    }

    // =============================================================
    //                            GETTERS
    // =============================================================

    function getMilestonesCount() external view returns (uint256) {
        return _milestones.length;
    }

    function getMilestone(uint256 milestoneId)
        external
        view
        milestoneExists(milestoneId)
        returns (EscrowTypes.Milestone memory)
    {
        return _milestones[milestoneId];
    }

    function getSummary()
        external
        view
        returns (
            address _client,
            address _contractor,
            address _arbiter,
            address _token,
            address _treasury,
            uint256 _totalAmount,
            uint256 _fundedAmount,
            uint256 _releasedAmount,
            uint96 _feeBps,
            EscrowTypes.DealStatus _status,
            string memory _metadataURI,
            string memory _disputeReasonURI
        )
    {
        return (
            client,
            contractor,
            arbiter,
            token,
            treasury,
            totalAmount,
            fundedAmount,
            releasedAmount,
            feeBps,
            status,
            metadataURI,
            disputeReasonURI
        );
    }

    function remainingBalance() public view returns (uint256) {
        if (fundedAmount <= releasedAmount) {
            return 0;
        }
        return fundedAmount - releasedAmount;
    }

    function currentMilestoneId() public view returns (uint256) {
        for (uint256 i = 0; i < _milestones.length; i++) {
            if (_milestones[i].status != EscrowTypes.MilestoneStatus.Approved) {
                return i;
            }
        }
        return _milestones.length;
    }

    function allMilestonesApproved() public view returns (bool) {
        for (uint256 i = 0; i < _milestones.length; i++) {
            if (_milestones[i].status != EscrowTypes.MilestoneStatus.Approved) {
                return false;
            }
        }
        return true;
    }

    // =============================================================
    //                      INTERNAL HELPERS
    // =============================================================

    function _setStatus(EscrowTypes.DealStatus newStatus) internal {
        EscrowTypes.DealStatus oldStatus = status;
        status = newStatus;
        emit StatusChanged(oldStatus, newStatus);
    }

    function _releaseMilestone(uint256 milestoneId) internal {
        EscrowTypes.Milestone storage milestone = _milestones[milestoneId];

        if (milestone.status != EscrowTypes.MilestoneStatus.Submitted) {
            revert EscrowErrors.MilestoneNotSubmitted();
        }

        uint256 grossAmount = milestone.amount;
        uint256 feeAmount = _feeAmount(grossAmount);
        uint256 netAmount = grossAmount - feeAmount;

        if (grossAmount > remainingBalance()) {
            revert EscrowErrors.DistributionExceedsBalance();
        }

        milestone.status = EscrowTypes.MilestoneStatus.Approved;
        releasedAmount += grossAmount;

        if (feeAmount > 0) {
            _transferPayment(treasury, feeAmount);
        }

        if (netAmount > 0) {
            _transferPayment(contractor, netAmount);
        }

        emit MilestoneApproved(milestoneId, grossAmount, feeAmount, netAmount);
    }

    function _feeAmount(uint256 grossAmount) internal view returns (uint256) {
        return (grossAmount * feeBps) / 10_000;
    }

    function _escrowToken() internal view returns (IERC20) {
        return IERC20(token);
    }

    function _transferPayment(address to, uint256 amount) internal {
        if (isNativePayment) {
            (bool success,) = payable(to).call{value: amount}("");
            if (!success) revert EscrowErrors.NativeTransferFailed();
        } else {
            _escrowToken().safeTransfer(to, amount);
        }
    }
}
