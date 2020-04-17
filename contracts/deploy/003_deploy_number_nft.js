
module.exports = async ({getNamedAccounts, deployments}) => {
    const {deployIfDifferent, log} = deployments;
    const {deployer} = await getNamedAccounts();

    let processor = await deployments.get('EIP712Forwarder');
    let contract = await deployments.getOrNull('Numbers');
    if (!contract) {
        const deployResult = await deployIfDifferent(['data'], "Numbers",  {from: deployer, gas: 4000000}, "Numbers", processor.address);
        contract = await deployments.get('Numbers');
        if(deployResult.newlyDeployed) {
            log(`Numbers deployed at ${contract.address} for ${deployResult.receipt.gasUsed}`);
        }
    }
}
