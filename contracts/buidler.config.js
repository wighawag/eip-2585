const {Wallet, BigNumber, utils} = require('ethers');
const {parseEther} = utils;
const fs = require('fs');
usePlugin("buidler-deploy");
usePlugin("buidler-ethers-v5");

let mnemonic;
try {
  mnemonic = fs.readFileSync('.mnemonic').toString()
} catch(e) {}

// ensure relayer is same as demo, TODO have namedAccounts specific config for tests 
const defaultBalance = parseEther('10000').toHexString();
const privateKey = '0xf912c020908da6935d420274cb1fa5fe609296ee3898bc190608a8d836463e27';
const relayPrivateKey = BigNumber.from(privateKey).sub(1).toHexString();
const accounts = [];
for (let i = 0 ; i < 10; i++) {
  if (i === 1) {
    accounts.push({
      privateKey: relayPrivateKey,
      balance: defaultBalance
    });
  } else {
    accounts.push({
      privateKey: Wallet.createRandom().privateKey,
      balance: defaultBalance
    })
  }
}

module.exports = {
  namedAccounts: {
      // TODO per chain
    deployer: 0,
    relayer: {
      default: 1,
      4: '0x7B7cd3876EC83efa98CbB251C3C0526eb355EA55',
    },
    others: "from:2"
  },
  solc: {
      version: '0.6.4',
      optimizer: {
          enabled: false,
          // runs: 200
      }
  },
  paths: {
    sources: 'src'
  },
  networks: {
    buidlerevm: {
      accounts,
    },
    // TODO blockTime: 6, ?
    rinkeby: {
      url: 'https://rinkeby.infura.io/v3/bc0bdd4eaac640278cdebc3aa91fabe4',
      accounts: mnemonic ? {
        mnemonic
      } : undefined
    }
  }
};
