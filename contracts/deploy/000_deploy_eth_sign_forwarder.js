
module.exports = async ({getNamedAccounts, deployments}) => {
    const {deployIfDifferent, log} = deployments;
    const {deployer} = await getNamedAccounts();

    let contract = await await deployments.get('EthSigForwarder');
    if (!contract) {
        const deployResult = await deployIfDifferent(['data'], "EthSigForwarder",  {from: deployer, gas: 4000000}, "EthSigForwarder");
        contract = await await deployments.get('EthSigForwarder');
        if(deployResult.newlyDeployed) {
            log(`EthSigForwarder deployed at ${contract.address} for ${deployResult.receipt.gasUsed}`);
        }
    }
}
module.exports.tags = ['EthSigForwarder'];