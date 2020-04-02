pragma solidity 0.6.4;

import "../ForwarderReceiverBase.sol";

contract ForwarderReceiver is ForwarderReceiverBase {

    constructor(address forwarder) public ForwarderReceiverBase(forwarder) {}

    event Test(address from, string name);
    function doSomething(address from, string calldata name) external {
        require(_getTxSigner() == from, "NOT_AUTHORIZED");
        emit Test(from, name);
    }

    mapping(address => uint256) _d;
    function test(uint256 d) external {
        address sender = _getTxSigner();
        _d[sender] = d;
    }
    function getData(address who) external view returns (uint256) {
        return _d[who];
    }

}
