
module.exports = async ({network, getNamedAccounts, deployments}) => {
    const {sendTxAndWait} = deployments;
    const {deployer, relayer} = await getNamedAccounts();

    if (!network.live) {
        await sendTxAndWait({from: deployer, to: relayer, value: '1000000000000000000'});
    }
}
// module.exports.skip = async () => true;