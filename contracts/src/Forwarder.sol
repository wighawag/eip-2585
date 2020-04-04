pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

interface Forwarder {

    enum SignatureType { DIRECT, EIP1654, EIP1271 }

    struct Message {
        address from;
        address to;
        uint256 chainId;
        address replayProtection;
        bytes nonce;
        bytes data;
        bytes32 innerMessageHash;
	}

    function forward(
        Message calldata message,
        SignatureType signatureType,
        bytes calldata signature
    ) external payable;
}
