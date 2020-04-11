const { ethers, deployments, getNamedAccounts } = require('@nomiclabs/buidler');
const {getChainId} = deployments;
const {signMessage, createEIP712Signer, abiEncode, abiDecode} = require('../../utils/signing');

module.exports.setupForwarderAndForwarderReceiver = (forwarderContractName, receiverContractName) => {
  return deployments.createFixture(async () => {
    const {deployer, relayer, others} = await getNamedAccounts();
    await deployments.fixture();
    const forwarder = await ethers.getContract(forwarderContractName, relayer);
    const receiver = await (await ethers.getContractFactory(receiverContractName || 'ForwarderReceiver', deployer)).deploy(forwarder.address);

    return {
      forwarder,
      receiver,
      relayer,
      others,
      chainId: await getChainId()
    };
  })();
};

module.exports.setupForEIP1776 = deployments.createFixture(async () => {
  const {receiver, others, relayer, forwarder, chainId} = await module.exports.setupForwarderAndForwarderReceiver('EIP712Forwarder');

  const EIP1776ForwarderWrapper = await ethers.getContract('EIP1776ForwarderWrapper', relayer);
  const forwarderSigner = createEIP712Signer({
    types : {
      EIP712Domain: [
        {name: 'name', type: 'string'},
        {name: 'version', type: 'string'}
      ],
      MetaTransaction: [
        {name: 'from', type: 'address'},
        {name: 'to', type: 'address'},
        {name: 'value', type: 'uint256'},
        {name: 'chainId', type: 'uint256'},
        {name: 'replayProtection', type: 'address'},
        {name: 'nonce', type: 'bytes'},
        {name: 'data', type: 'bytes'},
        {name: 'innerMessageHash', type: 'bytes32'},
      ]
    },
    domain: {
      name: 'Forwarder',
      version: '1',
    },
    primaryType: 'MetaTransaction',
  });
  const wrapperSigner = createEIP712Signer({
    types : {
      EIP712Domain: [
        {name: 'name', type: 'string'},
        {name: 'version', type: 'string'},
        {name: 'verifyingContract', type: 'address'}
      ],
      EIP1776_MetaTransaction: [
        {name: 'txGas', type: 'uint256'},
        {name: 'baseGas', type: 'uint256'},
        {name: 'expiry', type: 'uint256'},
        {name: 'tokenContract', type: 'address'},
        {name: 'tokenGasPrice', type: 'uint256'},
        {name: 'relayer', type: 'address'},
      ]
    },
    domain: {
      name: 'EIP-1776 Meta Transaction',
      version: '1',
      verifyingContract: EIP1776ForwarderWrapper.address
    },
    primaryType: 'EIP1776_MetaTransaction',
  });
  return {
    relayer, others, receiver, forwarder, chainId, forwarderSigner, wrapperSigner, EIP1776ForwarderWrapper
  };
});
