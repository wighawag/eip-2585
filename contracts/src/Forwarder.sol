pragma solidity 0.6.4;
pragma experimental ABIEncoderV2;

interface ERC1271 {
    function isValidSignature(bytes calldata data, bytes calldata signature) external view returns (bytes4 magicValue);
}

interface ERC1654 {
   function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4 magicValue);
}

interface NonceStrategy {
    // TODO? instead of return bool, we could throw on failure
    function checkAndUpdateNonce(address signer, bytes calldata nonce) external returns (bool);
    function getNonce(address signer) external returns (bytes memory);
}

library SigUtil {
    function recover(bytes32 hash, bytes memory sig) internal pure returns (address recovered) {
        require(sig.length == 65, "SIGNATURE_INVALID_LENGTH");

        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }

        // Version of signature should be 27 or 28, but 0 and 1 are also possible versions
        if (v < 27) {
            v += 27;
        }
        require(v == 27 || v == 28, "SIGNATURE_INVALID_V");

        recovered = ecrecover(hash, v, r, s);
        require(recovered != address(0), "SIGNATURE_ZERO_ADDRESS");
    }

    function eth_sign_prefix(bytes32 hash) internal pure returns (bytes memory) {
        return abi.encodePacked("\x19Ethereum Signed Message:\n32", hash);
    }
}

/// @notice Forwarder for Meta Transactions
contract Forwarder is NonceStrategy {

    // //////////////////////////////// TYPES AND CONSTANTS ////////////////////////////
    bytes4 internal constant ERC1271_MAGICVALUE = 0x20c13b0b;
    bytes4 internal constant ERC1654_MAGICVALUE = 0x1626ba7e;

    enum SignatureType { DIRECT, EIP1654, EIP1271 }

    struct Message {
        address from;
        address to;
        uint256 chainId;
        address nonceStrategy;
        bytes nonce;
        bytes data;
        bytes32 extraDataHash;
	}

    // ///////////////////////////// EXTERNAL INTERFACE ///////////////////////////////////

    /// @notice forward call from EOA signed message
    /// @param message.from address from which the message come from (For EOA this is the same as signer)
    /// @param message.to target of the call
    /// @param message.nonceStrategy contract address that check and update nonce
    /// @param message.nonce nonce value
    /// @param message.data call data
    /// @param message.extraDataHash extra data hashed that can be used as embedded message for implementing more complex scenario, with one sig
    /// @param signatureType signatureType either EOA, EIP1271 or EIP1654
    /// @param signature signature
    function forward(
        Message memory message,
        SignatureType signatureType,
        bytes memory signature
    ) public { // external is not supported in solidity < 0.6.4 when ABIEncoderV2 Struct are used
        require(_isValidChainId(message.chainId), "INVALID_CHAIN_ID");
        _checkSigner(message, signatureType, signature);

        // optimization to avoid call if using default nonce strategy
        // this contract implements a default nonce strategy and can be called directly
        if (message.nonceStrategy == address(0) || message.nonceStrategy == address(this)) {
            require(checkAndUpdateNonce(message.from, message.nonce), "NONCE_INVALID");
        } else {
            require(NonceStrategy(message.nonceStrategy).checkAndUpdateNonce(message.from, message.nonce), "NONCE_INVALID");
        }

        // TODO? allow the forwarder (calling forward) to pass msg.value on behalf of the message signer ?
        // if so we could simply use the msg.value as part of the message (no need to pass it in in the struct)
        (bool success, bytes memory returnData) = message.to.call(abi.encodePacked(message.data, message.from));
        require(success, string(returnData));
    }

    /// @notice implement a default nonce stategy
    /// @param signer address to check and update nonce for
    /// @param nonce value of nonce sent as part of the forward call
    function checkAndUpdateNonce(address signer, bytes memory nonce) public override returns (bool) {
        // TODO? default nonce strategy could be different (maybe the most versatile : batchId + Nonce)
        uint256 value = abi.decode(nonce, (uint256));
        uint256 currentNonce = _nonces[signer];
        if (value == currentNonce) {
            _nonces[signer] = currentNonce + 1;
            return true;
        }
        return false;
    }

    function getNonce(address signer) public override returns (bytes memory) {
        return abi.encode(_nonces[signer]);
    }

    /*
    mapping(address => mapping(uint256 => uint256)) batches;

    // params :
    uint256 batchId;
    uint256 batchNonce;

    // checks:
    require(batches[callData.from][callParams.batchId] + 1 == callParams.batchNonce, "batchNonce out of order");

    // perform
    batches[callData.from][callParams.batchId] = callParams.batchNonce;
    */

    // ///////////////////////////////// INTERNAL ////////////////////////////////////////////

    function _checkSigner(
        Message memory message,
        SignatureType signatureType,
        bytes memory signature
    ) internal view returns (address) {
        bytes memory dataToHash = _encodeMessage(message);
        if (signatureType == SignatureType.EIP1271) {
            require(ERC1271(message.from).isValidSignature(dataToHash, signature) == ERC1271_MAGICVALUE, "SIGNATURE_1271_INVALID");
        } else if(signatureType == SignatureType.EIP1654){
            require(ERC1654(message.from).isValidSignature(keccak256(dataToHash), signature) == ERC1654_MAGICVALUE, "SIGNATURE_1654_INVALID");
        } else {
            address signer = SigUtil.recover(keccak256(dataToHash), signature);
            require(signer == message.from, "SIGNATURE_WRONG_SIGNER");
        }
    }

    function _isValidChainId(uint256 chainId) internal view returns (bool) {
        uint256 _chainId;
        assembly {_chainId := chainid() }
        return chainId == _chainId;
    }

    function _encodeMessage(Message memory message) internal virtual pure returns (bytes memory) {
        return SigUtil.eth_sign_prefix(
            keccak256(
                abi.encodePacked(message.from, message.to, message.chainId, message.nonceStrategy, message.nonce, message.data, message.extraDataHash)
            )
        );
    }

    // /////////////////////////////////// STORAGE /////////////////////////////////////

    mapping(address => uint256) _nonces;
}