pragma solidity 0.6.1;

import "./Libraries/BytesUtil.sol";
import "./Libraries/AddressUtils.sol";
import "./Libraries/SigUtil.sol";
import "./Libraries/SafeMath.sol";
import "./Interfaces/ERC1271.sol";
import "./Interfaces/ERC1271Constants.sol";
import "./Interfaces/ERC1654.sol";
import "./Interfaces/ERC1654Constants.sol";
import "./Interfaces/ERC20.sol";

contract GenericMetaTransaction is ERC1271Constants, ERC1654Constants {

    // ////////////// LIBRARIES /////////////////
    using SafeMath for uint256;
    using AddressUtils for address;
    // //////////////////////////////////////////


    // /////////////// CONSTANTS ////////////////
    enum SignatureType { DIRECT, EIP1654, EIP1271 }

    bytes32 constant EIP712DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,address verifyingContract)"
    );
    bytes32 DOMAIN_SEPARATOR;

    bytes32 constant ERC20METATRANSACTION_TYPEHASH = keccak256(
        "ERC20MetaTransaction(address from,address to,address tokenContract,uint256 amount,bytes data,uint256 nonce,uint256 minGasPrice,uint256 txGas,uint256 baseGas,uint256 tokenGasPrice,address relayer)"
    );
    // //////////////////////////////////////////

    // //////////////// EVENTS //////////////////
    event MetaTx(
        address indexed from,
        uint256 indexed nonce,
        bool success
    ); // TODO specify event as part of ERC-1776 ?
    // //////////////////////////////////////////

    // //////////////// STATE ///////////////////
    mapping(address => uint256) nonces;
    // //////////////////////////////////////////

    constructor() public {
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                EIP712DOMAIN_TYPEHASH,
                keccak256("Generic Meta Transaction"),
                keccak256("1"),
                address(this)
            )
        );
    }

    /// @notice perform the meta-tx using EIP-712 message.
    /// @param addresses : from, to, tokenContract, relayer
    /// @param amount number of tokens to be transfered/allowed as part of the call.
    /// @param data bytes to send to the destination.
    /// @param params the meta-tx parameters : nonce, minGasPrice, txGas, baseGas, tokenGasPrice.
    /// @param signature the signature that ensure from has allowed the meta-tx to be performed.
    /// @param tokenReceiver recipient of the gas charge.
    /// @param signatureType indicate whether it was signed via EOA=0, EIP-1654=1 or EIP-1271=2.
    /// @return success whether the execution was successful.
    /// @return returnData data resulting from the execution.
    function executeERC20MetaTx(
        address[4] calldata addresses, // from, to, tokenContract, relayer
        uint256 amount,
        bytes calldata data,
        uint256[5] calldata params, // nonce, minGasPrice, txGas, baseGas, tokenGasPrice
        bytes calldata signature,
        address tokenReceiver,
        SignatureType signatureType
    ) external returns (bool success, bytes memory returnData) {
        _ensureParametersValidity(addresses[0], params, addresses[3]);
        _ensureCorrectSigner(
            addresses,
            amount,
            data,
            params,
            signature,
            signatureType
        );
        return
            _performERC20MetaTx(
                addresses[0],
                addresses[1],
                ERC20(addresses[2]),
                amount,
                data,
                params,
                tokenReceiver
            );
    }

    // ////////////////////////////// INTERNALS /////////////////////////

    function _ensureParametersValidity(
        address from,
        uint256[5] memory params, // nonce, minGasPrice, txGas, baseGas, tokenGasPrice
        address relayer
    ) internal view {
        require(
            relayer == address(0) || relayer == msg.sender,
            "wrong relayer"
        );
        require(nonces[from] + 1 == params[0], "nonce out of order");
        require(tx.gasprice >= params[1], "gasPrice < signer minGasPrice");
    }

    function _encodeMessage(
        address[4] memory addresses, // from, to, tokenContract, relayer
        uint256 amount,
        bytes memory data,
        uint256[5] memory params // nonce, minGasPrice, txGas, baseGas, tokenGasPrice
    ) internal view returns (bytes memory) {

        bytes memory paramsEncoded = abi.encode(
            params[0],
            params[1],
            params[2],
            params[3],
            params[4]
        );
        return abi.encodePacked(
            "\x19\x01",
            DOMAIN_SEPARATOR,
            keccak256(
                abi.encode(
                    ERC20METATRANSACTION_TYPEHASH,
                    addresses[0],
                    addresses[1],
                    addresses[2],
                    amount,
                    keccak256(data),
                    paramsEncoded,
                    addresses[3]
                )
            )
        );
    }

    function _ensureCorrectSigner(
        address[4] memory addresses, // from, to, tokenContract, relayer
        uint256 amount,
        bytes memory data,
        uint256[5] memory params, // nonce, minGasPrice, txGas, baseGas, tokenGasPrice
        bytes memory signature,
        SignatureType signatureType
    ) internal view {
        bytes memory dataToHash = _encodeMessage(addresses, amount, data, params);
        if (signatureType == SignatureType.EIP1271) {
            require(
                ERC1271(addresses[0]).isValidSignature(dataToHash, signature) == ERC1271_MAGICVALUE,
                "invalid 1271 signature"
            );
        } else if(signatureType == SignatureType.EIP1654){
            require(
                ERC1654(addresses[0]).isValidSignature(keccak256(dataToHash), signature) == ERC1654_MAGICVALUE,
                "invalid 1654 signature"
            );
        } else {
            address signer = SigUtil.recover(keccak256(dataToHash), signature);
            require(signer == addresses[0], "signer != from");
        }
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
        address to,
        uint256 gasLimit,
        bytes memory data
    ) internal returns (bool success, bytes memory returnData) {
        (success, returnData) = to.call.gas(gasLimit)(data);
        assert(gasleft() > gasLimit / 63); // not enough gas provided, assert to throw all gas // TODO use EIP-1930
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
        address from,
        address to,
        ERC20 tokenContract,
        uint256 gasLimit,
        uint256 tokenGasPrice,
        uint256 baseGasCharge,
        address tokenReceiver,
        bytes memory data
    ) internal returns (bool success, bytes memory returnData) {
        uint256 initialGas = gasleft();
        (success, returnData) = _executeWithSpecificGas(to, gasLimit, data);
        if (tokenGasPrice > 0) {
            _charge(from, tokenContract, gasLimit, tokenGasPrice, initialGas, baseGasCharge, tokenReceiver);
        }
    }

    function _performERC20MetaTx(
        address from,
        address to,
        ERC20 tokenContract,
        uint256 amount,
        bytes memory data,
        uint256[5] memory params, // nonce, minGasPrice, txGas, baseGas, tokenGasPrice
        address tokenReceiver
    ) internal returns (bool success, bytes memory returnData) {
        nonces[from] = params[0];

        if (data.length == 0) {
            if(params[4] > 0) {
                _transferAndChargeForGas(
                    from,
                    to,
                    tokenContract,
                    amount,
                    params[2],
                    params[4],
                    params[3],
                    tokenReceiver
                );
            } else {
                require(tokenContract.transferFrom(from, to, amount), "failed transfer");
            }
            success = true;
        } else {
            require(amount == 0, "amount > 0 and data");
            require(
                BytesUtil.doFirstParamEqualsAddress(data, from),
                "first param != from"
            );
            if(params[4] > 0) {
                (success, returnData) = _executeWithSpecificGasAndChargeForIt(
                    from,
                    to,
                    tokenContract,
                    params[2],
                    params[4],
                    params[3],
                    tokenReceiver,
                    data
                );
            } else {
                (success, returnData) = _executeWithSpecificGas(to, params[2], data);
            }
        }

        emit MetaTx(from, params[0], success);
    }
}