const {assert} = require('chai-local');
const { ethers, deployments, getNamedAccounts } = require('@nomiclabs/buidler');
const {Wallet} = require('ethers');
const {expectRevert, zeroAddress, extractRevertMessageFromHexString} = require('../../utils/testHelpers');
const {signMessage, createEIP712Signer, abiEncode, abiDecode} = require('../../utils/signing');
const {setupForEIP1776} = require('../fixtures');

const metaUserWallet = Wallet.createRandom();
  
describe("EIP-1776", () => {
  
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

