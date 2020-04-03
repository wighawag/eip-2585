pragma solidity 0.6.4;
pragma experimental ABIEncoderV2;

import "./Forwarder.sol";

/// @notice Forwarder for Meta Transactions Using EIP712 Signing Standard
contract EIP712Forwarder is Forwarder {

    bytes32 constant EIP712DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version)"
    );
    bytes32 constant DOMAIN_SEPARATOR = keccak256(
        abi.encode(
            EIP712DOMAIN_TYPEHASH,
            keccak256("Forwarder"),
            keccak256("1")
        )
    );

    bytes32 constant METATRANSACTION_TYPEHASH = keccak256(
        "MetaTransaction(address from,address to,uint256 value,uint256 chainId,address replayProtection,bytes nonce,bytes data,bytes32 extraDataHash)"
    );

    function _encodeMessage(Message memory message) internal override view returns (bytes memory) {
        return abi.encodePacked(
            "\x19\x01",
            DOMAIN_SEPARATOR,
            keccak256(abi.encode(
                METATRANSACTION_TYPEHASH,
                message.from,
                message.to,
                msg.value,
                message.chainId,
                message.replayProtection,
                keccak256(message.nonce),
                keccak256(message.data),
                message.extraDataHash
            ))
        );
    }
}