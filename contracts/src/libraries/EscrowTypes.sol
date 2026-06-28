// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

library EscrowTypes {
    enum DealStatus {
        Created,
        Accepted,
        Funded,
        InProgress,
        Disputed,
        Resolved,
        Completed,
        Cancelled
    }

    enum MilestoneStatus {
        Pending,
        Submitted,
        Approved,
        Refunded
    }

    struct MilestoneInput {
        uint256 amount;
        uint64 deadline;
        string descriptionURI;
    }

    struct Milestone {
        uint256 amount;
        uint64 deadline;
        MilestoneStatus status;
        string descriptionURI;
        string resultURI;
    }
}
