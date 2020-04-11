const assert = require('assert');
// const {BigNumber} = require('@ethersproject/bignumber');
const { deployments, getNamedAccounts } = require('@nomiclabs/buidler');
const {expectRevert, zeroAddress, extractRevertMessageFromHexString} = require('../../utils/testHelpers');

const {createWallet, instantiateContract} = require('../../utils');
const {signMessage, createEIP712Signer, abiEncode, abiDecode} = require('../../utils/signing');

const {sendTxAndWait, getChainId} = deployments;

const metaUserWallet = createWallet();

describe('Forwarder' ,() => {

  let chainId;
  let deployer;
  let relayer;
  let others;
  before(async function() {
    await deployments.fixture();
    chainId = await getChainId();
    const namedAccounts = await getNamedAccounts();
    deployer = namedAccounts.deployer;
    others = namedAccounts.others;
    relayer = others[0];
  });

  describe("EthSigForwarder", () => {
    beforeEach(async () => {
      await deployments.fixture(['EthSigForwarder']);
      const forwarderContract = await deployments.get('EthSigForwarder');
      await deployments.deploy("ForwarderReceiver",  {from: deployer, gas: 4000000}, "ForwarderReceiver", forwarderContract.address);
    })
    
    it("test forwarding call ", async function() {
      const receiver = await deployments.get('ForwarderReceiver');
      const receiverContract = instantiateContract(receiver);
      
      // construct message
      const {data} = await receiverContract.populateTransaction.doSomething(metaUserWallet.address, 'hello');
      const message = {
        from: metaUserWallet.address,
        to: receiverContract.address,
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
      const receipt = await sendTxAndWait({from: relayer}, 'EthSigForwarder', 'forward', // abiEvents option to merge events abi for parsing receipt
        message,
        0,
        signature
      );
  
      // console.log(JSON.stringify(receipt, null, '  '));
    });
  });
    
  describe("EIP712Forwarder", () => {
    beforeEach(async () => {
      await deployments.fixture(['EIP712Forwarder']);
      const forwarderContract = await deployments.get('EIP712Forwarder');
      await deployments.deploy("ForwarderReceiver",  {from: deployer, gas: 4000000}, "ForwarderReceiver", forwarderContract.address);
    })
    
    it("test forwarding call ", async function() {
      const receiver = await deployments.get('ForwarderReceiver');
      const receiverContract = instantiateContract(receiver);
      
      // construct message
      const {data} = await receiverContract.populateTransaction.doSomething(metaUserWallet.address, 'hello');
      const message = {
        from: metaUserWallet.address,
        to: receiverContract.address,
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
      const receipt = await sendTxAndWait({from: relayer}, 'EIP712Forwarder', 'forward', // abiEvents option to merge events abi for parsing receipt
        message,
        0,
        signature
      );
  
      // console.log(JSON.stringify(receipt, null, '  '));
    });
  });
  
  describe("EIP1776ForwarderWrapper", () => {
    let wrapper_eip712Signer;
    beforeEach(async () => {
      await deployments.fixture(['EIP1776ForwarderWrapper', 'DAI']);
      const forwarderContract = await deployments.get('EIP712Forwarder');
      await deployments.deploy("ForwarderReceiver",  {from: deployer, gas: 4000000}, "ForwarderReceiver", forwarderContract.address);
  
      const EIP1776ForwarderWrapper = await deployments.get('EIP1776ForwarderWrapper');
      wrapper_eip712Signer = createEIP712Signer({
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
    })
    
    it("test forwarding call ", async function() {
      const receiver = await deployments.get('ForwarderReceiver');
      const receiverContract = instantiateContract(receiver);
  
      
      const wrapper_params = {
        tokenContract: zeroAddress,
        expiry: 3000000000,
        txGas: 100000,
        baseGas: 30000,
        tokenGasPrice: 0,
        relayer: zeroAddress
      };
      const wrapper_hash = wrapper_eip712Signer.hash(wrapper_params);
      // MAKE IT FAIL : wrapper_params.amount = 1;
      
      // construct message
      const {data} = await receiverContract.populateTransaction.doSomething(metaUserWallet.address, 'hello');
      const message = {
        from: metaUserWallet.address,
        to: receiverContract.address,
        value: 0,
        chainId,
        replayProtection: zeroAddress,
        nonce: abiEncode(['uint256'], [0]), // '0x0000000000000000000000000000000000000000000000000000000000000000'
        data,
        innerMessageHash: wrapper_hash
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
      const receipt = await sendTxAndWait({from: relayer}, 'EIP1776ForwarderWrapper', 'relay', // abiEvents option to merge events abi for parsing receipt
        message,
        0,
        signature,
        wrapper_params,
        others[0]
      );
  
      const metaTxEvent = receipt.events[receipt.events.length - 1];
      assert.equal(metaTxEvent.event, 'MetaTx');
      assert.equal(metaTxEvent.args[1], true, 'MetaTx Call Failed : ' + (metaTxEvent.args[2].length > 10 ? extractRevertMessageFromHexString(metaTxEvent.args[2]) : metaTxEvent.args[2]));
  
      // console.log(JSON.stringify(receipt, null, '  '));
    });
  
    it("test batch call ", async function() {
      const receiver = await deployments.get('ForwarderReceiver');
      const receiverContract = instantiateContract(receiver);
  
      const wrapper_params = {
        tokenContract: zeroAddress,
        expiry: 3000000000,
        txGas: 100000,
        baseGas: 30000,
        tokenGasPrice: 0,
        relayer: zeroAddress
      };
      const wrapper_hash = wrapper_eip712Signer.hash(wrapper_params);
      // MAKE IT FAIL : wrapper_params.amount = 1;
      
      // construct batch message
      const token = instantiateContract(await deployments.get('DAI'));
      const approvalCall = await token.populateTransaction.approve(receiverContract.address, '10000000000000000000');
      approvalCall.value = 0;
      const doSomethingCall = await receiverContract.populateTransaction.doSomething(metaUserWallet.address, 'hello');
      doSomethingCall.value = 1;
      const forwarder = instantiateContract(await deployments.get('EIP712Forwarder'));
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
      const receipt = await sendTxAndWait({from: relayer, value:1}, 'EIP1776ForwarderWrapper', 'relay', // abiEvents option to merge events abi for parsing receipt
        message,
        0,
        signature,
        wrapper_params,
        others[0]
      );
  
      const metaTxEvent = receipt.events[receipt.events.length - 1];
      assert.equal(metaTxEvent.event, 'MetaTx');
      assert.equal(metaTxEvent.args[1], true, 'MetaTx Call Failed : ' + (metaTxEvent.args[2].length > 10 ? extractRevertMessageFromHexString(metaTxEvent.args[2]) : metaTxEvent.args[2]));
  
      // console.log(JSON.stringify(receipt, null, '  '));
    });
  });
});
