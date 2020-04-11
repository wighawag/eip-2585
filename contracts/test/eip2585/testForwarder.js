const {assert} = require('chai-local');
const { ethers, deployments, getNamedAccounts } = require('@nomiclabs/buidler');
const {Wallet} = require('ethers');
const {expectRevert, zeroAddress, extractRevertMessageFromHexString} = require('../../utils/testHelpers');
const {signMessage, createEIP712Signer, abiEncode, abiDecode} = require('../../utils/signing');
const {setupForwarderAndForwarderReceiver} = require('../fixtures');
const {getChainId} = deployments;

const metaUserWallet = Wallet.createRandom();


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
