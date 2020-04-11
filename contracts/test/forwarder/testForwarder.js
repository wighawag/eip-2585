const {assert} = require('chai-local');
const { ethers, deployments, getNamedAccounts } = require('@nomiclabs/buidler');
const {Wallet} = require('ethers');
const {expectRevert, zeroAddress, extractRevertMessageFromHexString} = require('../../utils/testHelpers');
const {signMessage, createEIP712Signer, abiEncode, abiDecode} = require('../../utils/signing');
const {getChainId} = deployments;

const metaUserWallet = Wallet.createRandom();

const setupForwarderAndForwarderReceiver = (forwarderContractName) => {
  return deployments.createFixture(async () => {
    const {deployer, relayer, others} = await getNamedAccounts();
    await deployments.fixture();
    const forwarder = await ethers.getContract(forwarderContractName, relayer);
    const receiver = await (await ethers.getContractFactory('ForwarderReceiver', deployer)).deploy(forwarder.address);

    return {
      forwarder,
      receiver,
      relayer,
      others,
      chainId: await getChainId()
    };
  })();
};

describe("EthSigForwarder", () => {  
  it("test forwarding call ", async function() {
    const {receiver, forwarder, chainId} = await setupForwarderAndForwarderReceiver('EthSigForwarder');
  
    // construct message
    const {data} = await receiver.populateTransaction.doSomething(metaUserWallet.address, 'hello');
    const message = {
      from: metaUserWallet.address,
      to: receiver.address,
      value: 0,
      chainId,
      replayProtection: zeroAddress,
      nonce: '0x0000000000000000000000000000000000000000000000000000000000000000',
      data,
      innerMessageHash: '0x0000000000000000000000000000000000000000000000000000000000000000'
    };

    // generate signature
    const signature = await signMessage(
      metaUserWallet,
      ['address', 'address', 'uint256', 'uint256', 'address',       'bytes', 'bytes', 'bytes32'],
      ['from',    'to',      'value',   'chainId', 'replayProtection', 'nonce', 'data',  'innerMessageHash'],
      message
    );
    
    // send transaction
    await forwarder.forward(message, 0, signature).then(tx => tx.wait());
  });
});
    
describe("EIP712Forwarder", () => {
  
  it("test forwarding call ", async function() {
    const {receiver, forwarder, chainId} = await setupForwarderAndForwarderReceiver('EIP712Forwarder');
    
    // construct message
    const {data} = await receiver.populateTransaction.doSomething(metaUserWallet.address, 'hello');
    const message = {
      from: metaUserWallet.address,
      to: receiver.address,
      value: 0,
      chainId,
      replayProtection: zeroAddress,
      nonce: '0x0000000000000000000000000000000000000000000000000000000000000000',
      data,
      innerMessageHash: '0x0000000000000000000000000000000000000000000000000000000000000000'
    };

    // generate signature
    const eip712Signer = createEIP712Signer({
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

    const signature = await eip712Signer.sign(metaUserWallet, message);
    
    // send transaction
    await forwarder.forward(message, 0, signature).then(tx => tx.wait());

    // console.log(JSON.stringify(receipt, null, '  '));
  });
});

const setupForEIP1776 = deployments.createFixture(async () => {
  const {receiver, others, relayer, forwarder, chainId} = await setupForwarderAndForwarderReceiver('EIP712Forwarder');

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
  
describe("EIP1776ForwarderWrapper", () => {
  
  it("test forwarding call ", async function() {
    const {wrapperSigner, forwarderSigner, receiver, EIP1776ForwarderWrapper, others, chainId} = await setupForEIP1776();
    
    const wrapper_params = {
      tokenContract: zeroAddress,
      expiry: 3000000000,
      txGas: 100000,
      baseGas: 30000,
      tokenGasPrice: 0,
      relayer: zeroAddress
    };
    const wrapper_hash = wrapperSigner.hash(wrapper_params);
    // MAKE IT FAIL : wrapper_params.amount = 1;
    
    // construct message
    const {data} = await receiver.populateTransaction.doSomething(metaUserWallet.address, 'hello');
    const message = {
      from: metaUserWallet.address,
      to: receiver.address,
      value: 0,
      chainId,
      replayProtection: zeroAddress,
      nonce: abiEncode(['uint256'], [0]), // '0x0000000000000000000000000000000000000000000000000000000000000000'
      data,
      innerMessageHash: wrapper_hash
    };

    // generate signature
    const signature = await forwarderSigner.sign(metaUserWallet, message);
    
    // send transaction
    const receipt = await EIP1776ForwarderWrapper.relay(message, 0, signature, wrapper_params, others[0]).then(tx => tx.wait());

    const metaTxEvent = receipt.events[receipt.events.length - 1];
    assert.equal(metaTxEvent.event, 'MetaTx');
    assert.equal(metaTxEvent.args[1], true, 'MetaTx Call Failed : ' + (metaTxEvent.args[2].length > 10 ? extractRevertMessageFromHexString(metaTxEvent.args[2]) : metaTxEvent.args[2]));

    // console.log(JSON.stringify(receipt, null, '  '));
  });

  it("test batch call ", async function() {
    const {wrapperSigner, forwarderSigner, receiver, forwarder, EIP1776ForwarderWrapper, others, chainId} = await setupForEIP1776();

    const wrapper_params = {
      tokenContract: zeroAddress,
      expiry: 3000000000,
      txGas: 100000,
      baseGas: 30000,
      tokenGasPrice: 0,
      relayer: zeroAddress
    };
    const wrapper_hash = wrapperSigner.hash(wrapper_params);
    // MAKE IT FAIL : wrapper_params.amount = 1;
    
    // construct batch message
    const token = await ethers.getContract('DAI');
    const approvalCall = await token.populateTransaction.approve(receiver.address, '10000000000000000000');
    approvalCall.value = 0;
    const doSomethingCall = await receiver.populateTransaction.doSomething(metaUserWallet.address, 'hello');
    doSomethingCall.value = 1;
    const {data} = await forwarder.populateTransaction.batch([approvalCall, doSomethingCall]);
    const message = {
      from: metaUserWallet.address,
      to: forwarder.address,
      value: 1,
      chainId,
      replayProtection: zeroAddress,
      nonce: abiEncode(['uint256'], [0]), // '0x0000000000000000000000000000000000000000000000000000000000000000'
      data,
      innerMessageHash: wrapper_hash
    };

    // generate signature
    const signature = await forwarderSigner.sign(metaUserWallet, message);
    
    // send transaction
    const receipt = await EIP1776ForwarderWrapper.relay(message, 0, signature, wrapper_params, others[0], {value:1}).then(tx => tx.wait());

    const metaTxEvent = receipt.events[receipt.events.length - 1];
    assert.equal(metaTxEvent.event, 'MetaTx');
    assert.equal(metaTxEvent.args[1], true, 'MetaTx Call Failed : ' + (metaTxEvent.args[2].length > 10 ? extractRevertMessageFromHexString(metaTxEvent.args[2]) : metaTxEvent.args[2]));

    // console.log(JSON.stringify(receipt, null, '  '));
  });
});

