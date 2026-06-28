// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

library EscrowErrors {
    error ZeroAddress();
    error ZeroAmount();
    error InvalidFeeBps();
    error InvalidStatus();
    error InvalidMilestones();
    error InvalidMilestoneId();
    error InvalidNativeAmount();

    error NotClient();
    error NotContractor();
    error NotArbiter();
    error NotAuthorized();
    error NotParticipant();
    error NotFactoryOwner();
    error ContractorNotAssigned();
    error TreasuryCannotActAsContractor();

    error TokenNotAllowed();
    error AlreadyAccepted();
    error AlreadyFunded();
    error NotFunded();

    error MilestoneNotPending();
    error MilestoneNotSubmitted();

    error DistributionExceedsBalance();
    error NativeTransferFailed();
}
