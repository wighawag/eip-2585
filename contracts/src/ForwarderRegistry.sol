pragma solidity 0.6.5;
contract ForwarderRegistry {

    /// @notice emitted for each Forwarder Approval or Disaproval
    event ForwarderApproved(address indexed signer, address indexed forwarder, bool approved, uint256 nonce);

    /// @notice return the current nonce for the signer/forwarder pair
    function getNonce(address signer, address forwarder) external view returns(uint256) {
        return uint256(_forwarders[signer][forwarder].nonce);
    }

    /// @notice return whether a forwarder is approved by a particular signer
    /// @param signer signer who authorized or not the forwarder
    /// @param forwarder meta transaction forwarder contract address
    function isForwarderFor(address signer, address forwarder) external view returns(bool) {
        return forwarder == address(this) || _forwarders[signer][forwarder].approved == 1;
    }

    /// @notice approve forwarder using the forwarder (which is msg.sender)
    /// @param approved whether to approve or disapprove (if previously approved) the forwarder
    /// @param signature signature by signer for approving forwarder
    function approveForwarder(bool approved, bytes calldata signature) external {
        _approveForwarder(_getSigner(), approved, signature);
    }

    /// @notice approve and forward the meta transaction in one call.
    /// This is useful for forwarder that would not support call batching so that the first meta-tx is self approving
    /// @param signature signature by signer for approving forwarder
    /// @param to destination of the call (that will receive the meta transaction)
    /// @param data the content of the call (the signer address will be appended to it)
    function approveAndForward(bytes calldata signature, address to, bytes calldata data) external payable {
        address signer = _getSigner();
        _approveForwarder(signer, true, signature);

        (bool success,) = to.call{value:msg.value}(abi.encodePacked(data, signer));
        if (!success) {
            assembly { // This assembly ensure the revert contains the exact string data
                let returnDataSize := returndatasize()
                returndatacopy(0, 0, returnDataSize)
                revert(0, returnDataSize)
            }
        }
    }
    
    // //////////////////////////////      INTERNAL         ////////////////////////////////////////
    function _getSigner() internal view returns(address signer) {
        bytes memory data = msg.data;
        uint256 length = msg.data.length;
        assembly { signer := mload(sub(add(data, length), 0x00)) } // forwarder would have added that
    }

    function _approveForwarder(address signer, bool approved, bytes memory signature) internal {
        address forwarder = msg.sender;
        Forwarder storage forwarderData = _forwarders[signer][forwarder];
        uint256 nonce = uint256(forwarderData.nonce);
        bytes memory dataToHash = _encodeMessage(signer, nonce, forwarder, approved);

        if (Utilities.isContract(signer)) {
            try ERC1271(signer).isValidSignature(dataToHash, signature) returns (bytes4 value) {
                require(value == ERC1271(0).isValidSignature.selector, "SIGNATURE_1271_INVALID");
            } catch (bytes memory /*lowLevelData*/) {}
            
            try ERC1654(signer).isValidSignature(keccak256(dataToHash), signature) returns (bytes4 value) {
                require(value == ERC1654(0).isValidSignature.selector, "SIGNATURE_1654_INVALID");
            } catch (bytes memory /*lowLevelData*/) {}
            revert("NO_SUPPORTED_CONTRACT_SIGNATURE");
        } else {
            require(signer == Utilities.recoverSigner(keccak256(dataToHash), signature), "SIGNATURE_INVALID");
        }

        forwarderData.approved = 1;
        forwarderData.nonce = uint248(nonce+1);
        emit ForwarderApproved(signer, forwarder, approved, nonce);
    }

    // //////////////////////////// SIGNED MESSAGE ENCODING //////////////////////////////////////////
    bytes32 constant EIP712DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,uint256 chainId)");
    bytes32 constant EIP712DOMAIN_NAME = keccak256("ForwarderRegistry");
    bytes32 constant APPROVAL_TYPEHASH = keccak256("ApproveForwarder(address signer,uint256 nonce,address forwarder,bool approved)");
    function _encodeMessage(address signer, uint256 nonce, address forwarder, bool approved) internal pure returns (bytes memory) {
        uint256 chainId;
        assembly { chainId := chainid() }
        return abi.encodePacked(
            "\x19\x01",
            abi.encode(
                EIP712DOMAIN_TYPEHASH,
                EIP712DOMAIN_NAME,
                chainId
            ),
            keccak256(abi.encode(
                APPROVAL_TYPEHASH,
                signer,
                nonce,
                forwarder,
                approved
            ))
        );
    }

    // ////////////////////////////  INTERNAL STORAGE  ///////////////////////////////////////////
    struct Forwarder {
        uint248 nonce;
        uint8 approved;
    }
    mapping(address => mapping(address => Forwarder)) internal _forwarders;
}

library Utilities {
    // ///////////////////////////// UTILITIES //////////////////////////////////////////////////
    function recoverSigner(bytes32 digest, bytes memory signature) internal pure returns(address) {
        require(signature.length == 65, "SIGNATURE_INVALID_LENGTH");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        return ecrecover(digest, v, r, s);
    }

    function isContract(address addr) internal view returns(bool) {
        // for accounts without code, i.e. `keccak256('')`:
        bytes32 accountHash = 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470;

        bytes32 codehash;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            codehash := extcodehash(addr)
        }
        return (codehash != 0x0 && codehash != accountHash);
    }
}

interface ERC1271 {
    function isValidSignature(bytes calldata data, bytes calldata signature) external view returns (bytes4 magicValue);
}

interface ERC1654 {
   function isValidSignature(bytes32 hash, bytes calldata signature) external view returns (bytes4 magicValue);
}
