pragma solidity 0.6.5;
import "./ForwarderRegistry.sol";
contract ReceiverTest is ReceiverBase{
    constructor(ForwarderRegistry forwarderRegistry) public ReceiverBase(forwarderRegistry) {}

    mapping(address => string) public names;
    function registerName(string calldata name) external {
        address signer = _getMsgSender();
        names[signer] = name;
    }
}