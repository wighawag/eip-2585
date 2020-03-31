pragma solidity 0.6.1;

interface ERC1271 {
    function isValidSignature(bytes calldata data, bytes calldata signature) external view returns (bytes4 magicValue);
}

interface ERC1654 {
   function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4 magicValue);
}

interface NonceStrategy {
    function checkAndUpdateNonce(address signer, bytes calldata nonce) external returns (bool);
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
}

/// @notice Forwarder for Meta Transactions
contract Forwarder is NonceStrategy {
    bytes4 internal constant ERC1271_MAGICVALUE = 0x20c13b0b;
    bytes4 internal constant ERC1654_MAGICVALUE = 0x1626ba7e;

    enum SignatureType { DIRECT, EIP1654, EIP1271 }

    /// @notice forward call from EOA signed message
    /// @param from address from which the message come from (For EOA this is the same as signer)
    /// @param target target of the call
    /// @param nonceStrategy contract address that check and update nonce
    /// @param nonce nonce value
    /// @param data call data
    /// @param extraDataHash extra data hashed that can be used as embedded message for implementing more complex scenario, with one sig
    /// @param signatureType signatureType either EOA, EIP1271 or EIP1654
    /// @param signature signature
    function forward(
        address from,
        address target,
        address nonceStrategy,
        bytes calldata nonce,
        bytes calldata data,
        bytes32 extraDataHash,
        SignatureType signatureType,
        bytes calldata signature
    ) external {
        _checkSigner(from, target, nonceStrategy, nonce, data, extraDataHash, signatureType, signature);
        if (nonceStrategy == address(0) || nonceStrategy == address(this)) { // optimization to avoid call if using default nonce strategy
            require(checkAndUpdateNonce(from, nonce), "NONCE_INVALID");
        } else {
            require(NonceStrategy(nonceStrategy).checkAndUpdateNonce(from, nonce), "NONCE_INVALID");
        }
        (bool success, bytes memory returnData) = target.call(abi.encodePacked(data, from));
        require(success, string(returnData));
    }

    function _checkSigner(
        address from,
        address target,
        address nonceStrategy,
        bytes memory nonce,
        bytes memory data,
        bytes32 extraDataHash,
        SignatureType signatureType,
        bytes memory signature
    ) internal view returns (address) {
        bytes memory dataToHash = _encodeMessage(target, nonceStrategy, nonce, data, extraDataHash);
        if (signatureType == SignatureType.EIP1271) {
            require(ERC1271(from).isValidSignature(dataToHash, signature) == ERC1271_MAGICVALUE, "SIGNATURE_1271_INVALID");
        } else if(signatureType == SignatureType.EIP1654){
            require(ERC1654(from).isValidSignature(keccak256(dataToHash), signature) == ERC1654_MAGICVALUE, "SIGNATURE_1654_INVALID");
        } else {
            address signer = SigUtil.recover(keccak256(dataToHash), signature);
            require(signer == from, "SIGNATURE_WRONG_SIGNER");
        }
    }

    function _encodeMessage(
        address target,
        address nonceStrategy,
        bytes memory nonce,
        bytes memory data,
        bytes32 extraDataHash
    ) internal view returns (bytes memory) {
        // TODO
        return abi.encode(target, nonceStrategy, nonce, data, extraDataHash);
    }

    /// @notice implement a default nonce stategy
    /// @param signer address to check and update nonce for
    /// @param nonce value of nonce sent as part of the forward call
    function checkAndUpdateNonce(address signer, bytes memory nonce) override public returns (bool) {
        uint256 value = abi.decode(nonce, (uint256));
        uint256 currentNonce = _nonces[signer];
        if (value == currentNonce) {
            _nonces[signer] = currentNonce + 1;
            return true;
        }
        return false;
    }

    mapping(address => uint256) _nonces;
}