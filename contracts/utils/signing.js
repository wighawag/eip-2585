const ethers = require('ethers');
const {solidityKeccak256, arrayify} = ethers.utils;
const ethSigUtil = require('eth-sig-util');

module.exports = {
  async signMessage(wallet, types, namesOrValues, message) {
    let values = [];
    if (message) {
        for(const name of namesOrValues) {
            values.push(message[name]);
        }
    } else {
        values = namesOrValues;
    }
    const hashedData = solidityKeccak256(types, values);
    const signature = await wallet.signMessage(arrayify(hashedData));
    return signature;
  },
  createEIP712Signer({types, domain, primaryType}) {
    return (wallet, message) => {
      return ethSigUtil.signTypedData(Buffer.from(wallet.privateKey.slice(2), 'hex'), {
        data: {
          types,
          domain,
          primaryType,
          message
        }
      });
    }
  }
};
