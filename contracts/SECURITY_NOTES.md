# Escrow Security Notes

## Payment Token Model

- `Escrow.token() == address(0)` means native ETH payment.
- Any non-zero payment token must pass `PaymentTokenValidation.requireEthOrMosUsdc`.
- `EscrowFactory` validates the payment token on deployment and on `setPaymentToken` / `setAllowedToken`.
- `EscrowFactory` stores a trusted `mosUSDC` address and rejects switching to a different MosUSDC-like token after it is set.
- `Escrow` validates the payment token again in its constructor, so direct deployments cannot bypass the rule.

## Accounting

- `fundedAmount` and `releasedAmount` are internal accounting values and do not depend on raw contract balance.
- Native ETH funding requires `msg.value == totalAmount`.
- MosUSDC funding requires `msg.value == 0` and pulls funds with `transferFrom`.
- Dispute split resolution must distribute the entire remaining accounted balance.

## Fees

- Fees are charged only on contractor-side payments.
- `resolveToClient` does not charge a fee.
- `resolveToContractor`, `resolveSplit`, and milestone approvals send fees to `treasury`.
- Fee rounding uses integer division: `(amount * feeBps) / 10_000`.

## Known MVP Assumptions

- The arbiter is trusted to resolve disputes correctly.
- The contract does not sweep unrelated tokens or ETH forced into it.
- MosUSDC identity is checked by metadata and decimals at the contract level; production users should rely on escrows created by the trusted factory.
- There is no deadline enforcement yet.
