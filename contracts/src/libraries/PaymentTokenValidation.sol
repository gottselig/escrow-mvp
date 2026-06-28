// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {MosUSDC} from "../MosUSDC.sol";
import {EscrowErrors} from "../common/EscrowErrors.sol";

library PaymentTokenValidation {
    address internal constant NATIVE_TOKEN = address(0);

    function requireEthOrMosUsdc(address tokenAddress) internal view {
        if (tokenAddress == NATIVE_TOKEN) return;
        if (tokenAddress.code.length == 0) revert EscrowErrors.TokenNotAllowed();

        try MosUSDC(tokenAddress).name() returns (string memory name_) {
            bytes32 nameHash = keccak256(bytes(name_));
            bool isKnownMosUSDCName =
                nameHash == keccak256(bytes("MosUSDC")) || nameHash == keccak256(bytes("Moscow USD Coin"));

            if (!isKnownMosUSDCName) {
                revert EscrowErrors.TokenNotAllowed();
            }
        } catch {
            revert EscrowErrors.TokenNotAllowed();
        }

        try MosUSDC(tokenAddress).symbol() returns (string memory symbol_) {
            if (keccak256(bytes(symbol_)) != keccak256(bytes("mUSDC"))) {
                revert EscrowErrors.TokenNotAllowed();
            }
        } catch {
            revert EscrowErrors.TokenNotAllowed();
        }

        try MosUSDC(tokenAddress).decimals() returns (uint8 decimals_) {
            if (decimals_ != 6) revert EscrowErrors.TokenNotAllowed();
        } catch {
            revert EscrowErrors.TokenNotAllowed();
        }
    }
}
