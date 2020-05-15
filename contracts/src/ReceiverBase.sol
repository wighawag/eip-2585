pragma solidity 0.6.5;
abstract contract ReceiverBase {
    ForwarderRegistry immutable _forwarderRegistry;
    constructor(ForwarderRegistry forwarderRegistry) internal {
        _forwarderRegistry = forwarderRegistry;
    }
    
    function  _getMsgSender() internal view returns (address payable signer) {
        bytes memory data = msg.data;
        uint256 length = msg.data.length;
        assembly { signer := mload(sub(add(data, length), 0x00)) }
        if(msg.sender != _forwarderRegistry && !_forwarderRegistry.isForwarderFor(signer, msg.sender)) {
            signer = msg.sender;    
        }
    }
}