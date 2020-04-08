
module.exports = async ({network, namedAccounts, deployments}) => {
    const {sendTxAndWait} = deployments;
    const {deployer, relayer} = namedAccounts;

    if (!network.live) {
        console.log('feeding relayer ' + relayer);
        await sendTxAndWait({from: deployer, to: relayer, value: '1000000000000000000'});
    }
}
// module.exports.skip = async () => true;