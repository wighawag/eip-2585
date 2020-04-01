const { deployments, namedAccounts } = require('@nomiclabs/buidler');
const {expectRevert, zeroAddress} = require('../../utils/testHelpers');

const {createWallet, instantiateContract} = require('../../utils');
const {signMessage, createEIP712Signer} = require('../../utils/signing');

const {sendTxAndWait} = deployments;
const {deployer, others} = namedAccounts;

const relayer = others[0];

const metaUserWallet = createWallet();

describe("Forwarder", () => {
  beforeEach(async () => {
    await deployments.run(['Forwarder']);
    const forwarderContract = deployments.get('Forwarder');
    await deployments.deploy("ForwarderReceiver",  {from: deployer, gas: 4000000}, "ForwarderReceiver", forwarderContract.address);
  })
  
  it("test forwarding call ", async function() {
    const receiver = deployments.get('ForwarderReceiver');
    const receiverContract = instantiateContract(receiver);
    
    // construct message
    const {data} = await receiverContract.populateTransaction.doSomething(metaUserWallet.address, 'hello');
    const message = {
      from: metaUserWallet.address,
      to: receiverContract.address,
      chainId: 31337,
      nonceStrategy: zeroAddress,
      nonce: '0x0000000000000000000000000000000000000000000000000000000000000000',
      data,
      extraDataHash: '0x0000000000000000000000000000000000000000000000000000000000000000'
    };

    // generate signature
    const signature = await signMessage(
      metaUserWallet,
      ['address', 'address', 'uint256', 'address',       'bytes', 'bytes', 'bytes32'],
      ['from',    'to',      'chainId', 'nonceStrategy', 'nonce', 'data',  'extraDataHash'],
      message
    );
    
    // send transaction
    const receipt = await sendTxAndWait({from: relayer}, 'Forwarder', 'forward', // abiEvents option to merge events abi for parsing receipt
      message,
      0,
      signature
    );

    // console.log(JSON.stringify(receipt, null, '  '));
  });
});

describe("EIP712Forwarder", () => {
  beforeEach(async () => {
    await deployments.run(['EIP712Forwarder']);
    const forwarderContract = deployments.get('EIP712Forwarder');
    await deployments.deploy("ForwarderReceiver",  {from: deployer, gas: 4000000}, "ForwarderReceiver", forwarderContract.address);
  })
  
  it("test forwarding call ", async function() {
    const receiver = deployments.get('ForwarderReceiver');
    const receiverContract = instantiateContract(receiver);
    
    // construct message
    const {data} = await receiverContract.populateTransaction.doSomething(metaUserWallet.address, 'hello');
    const message = {
      from: metaUserWallet.address,
      to: receiverContract.address,
      chainId: 31337,
      nonceStrategy: zeroAddress,
      nonce: '0x0000000000000000000000000000000000000000000000000000000000000000',
      data,
      extraDataHash: '0x0000000000000000000000000000000000000000000000000000000000000000'
    };

    // generate signature
    const signEIP712 = createEIP712Signer({
      types : {
        EIP712Domain: [
          {name: 'name', type: 'string'},
          {name: 'version', type: 'string'}
        ],
        MetaTransaction: [
          {name: 'from', type: 'address'},
          {name: 'to', type: 'address'},
          {name: 'chainId', type: 'uint256'},
          {name: 'nonceStrategy', type: 'address'},
          {name: 'nonce', type: 'bytes'},
          {name: 'data', type: 'bytes'},
          {name: 'extraDataHash', type: 'bytes32'},
        ]
      },
      domain: {
        name: 'Forwarder',
        version: '1',
      },
      primaryType: 'MetaTransaction',
    });

    const signature = await signEIP712(metaUserWallet, message);
    
    // send transaction
    const receipt = await sendTxAndWait({from: relayer}, 'EIP712Forwarder', 'forward', // abiEvents option to merge events abi for parsing receipt
      message,
      0,
      signature
    );

    // console.log(JSON.stringify(receipt, null, '  '));
  });
});