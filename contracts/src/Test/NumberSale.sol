pragma solidity 0.6.4;

import "../ForwarderReceiverBase.sol";
import "./Numbers.sol";
import "../Interfaces/ERC20.sol";

contract NumberSale is ForwarderReceiverBase {

    Numbers internal /*immutable*/ _numbers;
    ERC20 internal /*immutable*/ _erc20Token;
    uint256 internal /*immutable*/ _price;
    address internal /*immutable*/ _eip1776;  // TODO remove
    constructor(Numbers numbers, ERC20 erc20Token, uint256 price, address forwarder, address eip1776) public ForwarderReceiverBase(forwarder) {
        _numbers = numbers;
        _erc20Token = erc20Token;
        _price = price;
        _eip1776 = eip1776; // TODO remove
    }

    function purchase(address from, address to) external {
        require(from == _getTxSigner(), "NOT_AUTHORIZED"); // get signer

        // Here we transfer from the sender
        // this works because the meta tx processor will be owing the ERC20 token temporarly
        // This allow the user to never need to approve ERC20 token before hand when using metatx
        require(_erc20Token.transferFrom(from, address(this), _price), "ERC20_TRANSFER_FAILED");

        // if all is good we mint
        _numbers.mint(to);
    }
}
