pragma solidity 0.6.4;
pragma experimental ABIEncoderV2;

import "./EIP712Forwarder.sol";
import "./Libraries/BytesUtil.sol";
import "./Libraries/AddressUtils.sol";
import "./Libraries/SafeMath.sol";
import "./Interfaces/ERC20.sol";

contract EIP1776ForwarderWrapper {

    // ////////////// LIBRARIES /////////////////
    using SafeMath for uint256;
    using AddressUtils for address;
    // //////////////////////////////////////////

    bytes32 constant EIP712DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,address verifyingContract)"
    );
    bytes32 DOMAIN_SEPARATOR;

    bytes32 constant ERC20METATRANSACTION_TYPEHASH = keccak256(
        "ERC20MetaTransaction(address tokenContract,uint256 amount,uint256 expiry,uint256 txGas,uint256 baseGas,uint256 tokenGasPrice,address relayer)"
    );
    Forwarder _forwarder;
    constructor(Forwarder forwarder) public {
        _forwarder = forwarder;
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                EIP712DOMAIN_TYPEHASH,
                keccak256("Generic Meta Transaction"),
                keccak256("1"),
                address(this)
            )
        );
    }

    // //////////////// EVENTS //////////////////
    event MetaTx(
        address indexed from,
        bool success,
        bytes returnData
    ); // TODO specify event as part of ERC-1776 ?
    // //////////////////////////////////////////

    // //////////////// STATE ///////////////////
    bool lock = false;
    // //////////////////////////////////////////

    struct CallParams {
        address tokenContract;
        uint256 amount;
        uint256 expiry;
        uint256 txGas;
        uint256 baseGas;
        uint256 tokenGasPrice;
        address relayer;
    }

    function executeMetaTransaction(
        Forwarder.Message memory message,
        Forwarder.SignatureType signatureType,
        bytes memory signature,
        CallParams memory callParams,
        address tokenReceiver
    ) public returns (bool success, bytes memory returnData) {
        require(!lock, "IN_PROGRESS");
        lock = true;
        _ensureParametersValidity(callParams);
        _ensureCorrectCallParams(message.extraDataHash, callParams);
        (success, returnData) = _performERC20MetaTx(message, signatureType, signature, callParams, tokenReceiver);
        lock = false;
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
            ERC20METATRANSACTION_TYPEHASH,
            callParams.tokenContract,
            callParams.amount,
            callParams.expiry,
            callParams.txGas,
            callParams.baseGas,
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
        try _forwarder.forward{gas: gasLimit}(message, signatureType, signature) {
        } catch (bytes memory returnData) {
            assert(gasleft() > gasLimit / 63); // not enough gas provided, assert to throw all gas // TODO use EIP-1930
            return (false, returnData);
        }
        return (true, "");
        // (bool success, bytes memory returnData) = address(_forwarder).call.gas(gasLimit)(abi.encodeWithSignature("forward(Message,SignatureType,signature)", message, signatureType, signature));
        // assert(gasleft() > gasLimit / 63); // not enough gas provided, assert to throw all gas // TODO use EIP-1930
        // return (success, returnData);
    }

    function _transferAndChargeForGas(
        address from,
        address to,
        ERC20 tokenContract,
        uint256 amount,
        uint256 gasLimit,
        uint256 tokenGasPrice,
        uint256 baseGasCharge,
        address tokenReceiver
    ) internal returns (bool) {
        uint256 initialGas = gasleft();
        tokenContract.transferFrom(from, to, amount);
        if (tokenGasPrice > 0) {
            _charge(from, tokenContract, gasLimit, tokenGasPrice, initialGas, baseGasCharge, tokenReceiver);
        }
        return true;
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

    function _performERC20MetaTx(
        Forwarder.Message memory message,
        Forwarder.SignatureType signatureType,
        bytes memory signature,
        CallParams memory callParams,
        address tokenReceiver
    ) internal returns (bool success, bytes memory returnData) {
        ERC20 tokenContract = ERC20(callParams.tokenContract);

        if (message.data.length == 0) {
            if(callParams.tokenGasPrice > 0) {
                _transferAndChargeForGas(
                    message.from,
                    message.to,
                    tokenContract,
                    callParams.amount,
                    callParams.txGas,
                    callParams.tokenGasPrice,
                    callParams.baseGas,
                    tokenReceiver
                );
            } else {
                require(tokenContract.transferFrom(message.from, message.to, callParams.amount), "ERC20_TRANSFER_FAILED");
            }
            success = true;
        } else {
            uint256 previousBalance;
            if(callParams.amount > 0) {
                previousBalance = tokenContract.balanceOf(address(this));
                require(tokenContract.transferFrom(message.from, address(this), callParams.amount), "ERC20_ALLOCATION_FAILED");
                tokenContract.approve(message.to, callParams.amount);
            }
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
            if(callParams.amount > 0) {
                uint256 newBalance = tokenContract.balanceOf(address(this));
                if (newBalance > previousBalance) {
                    require(tokenContract.transfer(message.from, newBalance - previousBalance), "ERC20_REFUND_FAILED");
                }
            }
        }

        emit MetaTx(message.from, success, returnData);
    }

    // TODO
    // function batch(address from, address[] calldata tos, bytes[] calldata datas, uint256[] calldata gas) external {
    //     require(msg.sender == address(this), "can only be executed by the meta tx processor");
    //     for(uint256 i = 0; i < tos.length; i++) {
    //         require(
    //             BytesUtil.doFirstParamEqualsAddress(datas[i], from),
    //             "first param != from"
    //         );
    //         _executeWithSpecificGas(tos[i], gas[i], datas[i]);
    //     }
    // }
}
