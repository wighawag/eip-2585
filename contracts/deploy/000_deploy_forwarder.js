
module.exports = async ({namedAccounts, deployments}) => {
    const {deployIfDifferent, log} = deployments;
    const {deployer} = namedAccounts;

    let contract = deployments.get('Forwarder');
    if (!contract) {
        const deployResult = await deployIfDifferent(['data'], "Forwarder",  {from: deployer, gas: 4000000}, "Forwarder");
        contract = deployments.get('Forwarder');
        if(deployResult.newlyDeployed) {
            log(`Forwarder deployed at ${contract.address} for ${deployResult.receipt.gasUsed}`);
        }
    }
}
module.exports.tags = ['Forwarder'];