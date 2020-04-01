const { deployments, namedAccounts } = require('@nomiclabs/buidler');
const {expectRevert, zeroAddress} = require('../../utils/testHelpers');

const {createWallet, instantiateContract} = require('../../utils');
const {signMessage} = require('../../utils/signing');

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
      chainId: 31337,
      target: receiverContract.address,
      nonceStrategy: zeroAddress,
      nonce: '0x0000000000000000000000000000000000000000000000000000000000000000',
      data,
      extraDataHash: '0x0000000000000000000000000000000000000000000000000000000000000000'
    };

    // generate signature
    const signature = await signMessage(
      metaUserWallet,
      ['address', 'uint256', 'address',       'bytes', 'bytes', 'bytes32'],
      ['target',  'chainId', 'nonceStrategy', 'nonce', 'data',  'extraDataHash'],
      message
    );
    
    // send transaction
    const receipt = await sendTxAndWait({from: relayer}, 'Forwarder', 'forward', // abiEvents option to merge events abi for parsing receipt
      metaUserWallet.address,
      message,
      0,
      signature
    );

    // console.log(JSON.stringify(receipt, null, '  '));
  });
});