
module.exports = async ({network, getNamedAccounts, deployments}) => {
    const {sendTxAndWait} = deployments;
    const {deployer, relayer} = await getNamedAccounts();

    if (!network.live) {
        console.log('feeding relayer ' + relayer);
        await sendTxAndWait({from: deployer, to: relayer, value: '1000000000000000000'});
    }
}
// module.exports.skip = async () => true;