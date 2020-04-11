const { ethereum } = require('@nomiclabs/buidler');
const ethers = require('ethers');
const {Wallet, Contract} = ethers;
const {Web3Provider} = ethers.providers;

const ethersProvider = new Web3Provider(ethereum);

module.exports = {
    createWallet() {
        return Wallet.createRandom().connect(ethersProvider);
    },
    instantiateContract(contractInfo) {
        return new Contract(contractInfo.address, contractInfo.abi, ethersProvider);
    }
};
