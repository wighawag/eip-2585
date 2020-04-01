pragma solidity 0.6.4;

contract ForwarderReceiver  {
    address /* immutable */ _metaTxProcessor;
    constructor(address metaTxProcessor) public {
        _metaTxProcessor = metaTxProcessor;
    }

    event Test(address from, string name);
    function doSomething(address from, string calldata name) external {
        require(_getSigner() == from, "NOT_AUTHORIZED");
        emit Test(from, name);
    }

    mapping(address => uint256) _d;
    function test(uint256 d) external {
        address sender = _getSigner();
        _d[sender] = d;
    }
    function getData(address who) external view returns (uint256) {
        return _d[who];
    }

    function _getSigner() internal view returns (address payable signer) {
        if (msg.sender == _metaTxProcessor) {
            bytes memory data = msg.data;
            uint256 length = msg.data.length;
            assembly { signer := and(mload(sub(add(data, length), 0x00)), 0xffffffffffffffffffffffffffffffffffffffff) }
        } else {
            signer = msg.sender;
        }
	}
}
