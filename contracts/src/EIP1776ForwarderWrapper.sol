pragma solidity 0.6.4;
pragma experimental ABIEncoderV2;

import "./EIP712Forwarder.sol";
import "./Libraries/BytesUtil.sol";
import "./Libraries/AddressUtils.sol";
import "./Libraries/SafeMath.sol";
import "./Interfaces/ERC20.sol";

contract EIP1776ForwarderWrapper {

    // //////////////// EVENTS //////////////////////////////////////////
    event MetaTx(
        address indexed from,
        bool success,
        bytes returnData
    );

    // //////////////////////// TYPES /////////////////////////////////////
    struct CallParams {
        uint256 txGas;
        uint256 baseGas;
        uint256 expiry;
        address tokenContract;
        uint256 tokenGasPrice;
        address relayer;
    }

    // /////////////////////// EXTERNAL INTERFACE ///////////////////////////
    function relay(
        Forwarder.Message memory message,
        Forwarder.SignatureType signatureType,
        bytes memory signature,
        CallParams memory callParams,
        address tokenReceiver
    ) public payable returns (bool success, bytes memory returnData) {
        _ensureParametersValidity(callParams);
        _ensureCorrectCallParams(message.extraDataHash, callParams);
        (success, returnData) = _forwardMetaTx(message, signatureType, signature, callParams, tokenReceiver);
    }




    // ////////////////////////////// INTERNALS /////////////////////////

    function _ensureParametersValidity(CallParams memory callParams) internal view {
        require(callParams.relayer == address(0) || callParams.relayer == msg.sender, "wrong relayer");
        require(block.timestamp < callParams.expiry, "expired");
    }

    function _encodeMessage(CallParams memory callParams) internal view returns (bytes memory) {
        return abi.encodePacked(
            "\x19\x01",
            DOMAIN_SEPARATOR,
            keccak256(messageBytes(callParams))
        );
    }

    function messageBytes(CallParams memory callParams) internal pure returns(bytes memory) {
        return abi.encode(
            METATRANSACTION_TYPEHASH,
            callParams.txGas,
            callParams.baseGas,
            callParams.expiry,
            callParams.tokenContract,
            callParams.tokenGasPrice,
            callParams.relayer
        );
    }

    function _ensureCorrectCallParams(bytes32 expectedHash, CallParams memory callParams) internal view {
        bytes memory dataToHash = _encodeMessage(callParams);
        require(keccak256(dataToHash) == expectedHash, "call params not matching");
    }

    function _charge(
        address from,
        ERC20 tokenContract,
        uint256 gasLimit,
        uint256 tokenGasPrice,
        uint256 initialGas,
        uint256 baseGasCharge,
        address tokenReceiver
    ) internal {
        uint256 gasCharge = initialGas - gasleft();
        if(gasCharge > gasLimit) {
            gasCharge = gasLimit;
        }
        gasCharge += baseGasCharge;
        uint256 tokensToCharge = gasCharge * tokenGasPrice;
        require(tokensToCharge / gasCharge == tokenGasPrice, "overflow");
        tokenContract.transferFrom(from, tokenReceiver, tokensToCharge);
    }

    function _executeWithSpecificGas(
        Forwarder.Message memory message,
        Forwarder.SignatureType signatureType,
        bytes memory signature,
        uint256 gasLimit
    ) internal returns (bool, bytes memory) {
        try _forwarder.forward{gas: gasLimit, value: msg.value}(message, signatureType, signature) {
            return (true, "");
        } catch (bytes memory returnData) {
            assert(gasleft() > gasLimit / 63); // not enough gas provided, assert to throw all gas // TODO use EIP-1930
            return (false, returnData);
        }
    }

    function _executeWithSpecificGasAndChargeForIt(
        Forwarder.Message memory message,
        Forwarder.SignatureType signatureType,
        bytes memory signature,
        ERC20 tokenContract,
        uint256 gasLimit,
        uint256 tokenGasPrice,
        uint256 baseGasCharge,
        address tokenReceiver
    ) internal returns (bool success, bytes memory returnData) {
        uint256 initialGas = gasleft();
        (success, returnData) = _executeWithSpecificGas(message, signatureType, signature, gasLimit);
        if (tokenGasPrice > 0) {
            _charge(message.from, tokenContract, gasLimit, tokenGasPrice, initialGas, baseGasCharge, tokenReceiver);
        }
    }

    function _forwardMetaTx(
        Forwarder.Message memory message,
        Forwarder.SignatureType signatureType,
        bytes memory signature,
        CallParams memory callParams,
        address tokenReceiver
    ) internal returns (bool success, bytes memory returnData) {
        ERC20 tokenContract = ERC20(callParams.tokenContract);

        if(callParams.tokenGasPrice > 0) {
            (success, returnData) = _executeWithSpecificGasAndChargeForIt(
                message,
                signatureType,
                signature,
                tokenContract,
                callParams.txGas,
                callParams.tokenGasPrice,
                callParams.baseGas,
                tokenReceiver
            );
        } else {
            (success, returnData) = _executeWithSpecificGas(message, signatureType, signature, callParams.txGas);
        }
        emit MetaTx(message.from, success, returnData);
    }

    // ////////////// LIBRARIES /////////////////
    using SafeMath for uint256;
    using AddressUtils for address;
    // //////////////////////////////////////////

    bytes32 constant EIP712DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,address verifyingContract)"
    );
    bytes32 DOMAIN_SEPARATOR;

    bytes32 constant METATRANSACTION_TYPEHASH = keccak256(
        "EIP1776_MetaTransaction(uint256 txGas,uint256 baseGas,uint256 expiry,address tokenContract,uint256 tokenGasPrice,address relayer)"
    );
    Forwarder _forwarder;
    constructor(Forwarder forwarder) public {
        _forwarder = forwarder;
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                EIP712DOMAIN_TYPEHASH,
                keccak256("EIP-1776 Meta Transaction"),
                keccak256("1"),
                address(this)
            )
        );
    }
}
