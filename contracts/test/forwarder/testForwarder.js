const { deployments, namedAccounts } = require('@nomiclabs/buidler');
const {expectRevert, zeroAddress} = require('../../utils/testHelpers');

const {sendTxAndWait} = deployments;
const {deployer, others} = namedAccounts;

const relayer = others[0];
const metaUser = others[1];

describe("Forwarder", () => {
  beforeEach(async () => {
    await deployments.run(['Forwarder']);
    const forwarderContract = deployments.get('Forwarder');
    await deployments.deploy("ForwarderReceiver",  {from: deployer, gas: 4000000}, "ForwarderReceiver", forwarderContract.address);
  })
  it("testing ", async function() {
    const signature = '0x'; // TODO
    await sendTxAndWait({from: relayer}, 'Forwarder', 'forward',
      metaUser,
      {
        chainId: 31337,
        target: zeroAddress,
        nonceStrategy: zeroAddress,
        nonce: 0,
        data: '0x',
        extraDataHash: '0x0000000000000000000000000000000000000000000000000000000000000000'
      },
      0,
      signature
    );
  });
  it("testing bid over", async function() {
    await sendTxAndWait({from: others[0], value: 1}, 'ERC721BidSale', 'bid');
    await sendTxAndWait({from: buyer, value: 2}, 'ERC721BidSale', 'bid');
  });
  it("testing bid over fails if too low", async function() {
    await sendTxAndWait({from: others[0], value: 2}, 'ERC721BidSale', 'bid');
    await expectRevert(sendTxAndWait({from: buyer, value: 1}, 'ERC721BidSale', 'bid'), 'BID_TOO_LOW');
  });
});