const ethers = require('ethers');
const {solidityKeccak256, arrayify} = ethers.utils;

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
  }
};
