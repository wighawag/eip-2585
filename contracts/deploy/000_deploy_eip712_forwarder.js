
module.exports = async ({namedAccounts, deployments}) => {
    const {deployIfDifferent, log} = deployments;
    const {deployer} = namedAccounts;

    let contract = deployments.get('EIP712Forwarder');
    if (!contract) {
        const deployResult = await deployIfDifferent(['data'], "EIP712Forwarder",  {from: deployer, gas: 4000000}, "EIP712Forwarder");
        contract = deployments.get('EIP712Forwarder');
        if(deployResult.newlyDeployed) {
            log(`EIP712Forwarder deployed at ${contract.address} for ${deployResult.receipt.gasUsed}`);
        }
    }
}
module.exports.tags = ['EIP712Forwarder'];