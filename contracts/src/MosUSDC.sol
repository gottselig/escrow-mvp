// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MosUSDC is ERC20, Ownable {
    uint8 private constant _DECIMALS = 6;

    constructor(
        address initialOwner,
        uint256 initialSupply
    ) ERC20("MosUSDC", "mUSDC") Ownable(initialOwner) {
        _mint(initialOwner, initialSupply);
    }

    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }
}
