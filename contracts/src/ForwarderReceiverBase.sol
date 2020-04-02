pragma solidity 0.6.4;

contract ForwarderReceiverBase {
    address /* immutable */ _forwarder;
    constructor(address forwarder) public {
        _forwarder = forwarder;
    }

    function _getTxSigner() internal view returns (address payable signer) {
        if (msg.sender == _forwarder) {
            bytes memory data = msg.data;
            uint256 length = msg.data.length;
            assembly { signer := and(mload(sub(add(data, length), 0x00)), 0xffffffffffffffffffffffffffffffffffffffff) }
        } else {
            signer = msg.sender;
        }
	}
}