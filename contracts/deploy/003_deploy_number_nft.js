
module.exports = async ({namedAccounts, deployments}) => {
    const {deployIfDifferent, log} = deployments;
    const {deployer} = namedAccounts;

    let processor = await deployments.get('EIP712Forwarder');
    let contract = await deployments.get('Numbers');
    if (!contract) {
        const deployResult = await deployIfDifferent(['data'], "Numbers",  {from: deployer, gas: 4000000}, "Numbers", processor.address);
        contract = await deployments.get('Numbers');
        if(deployResult.newlyDeployed) {
            log(`Numbers deployed at ${contract.address} for ${deployResult.receipt.gasUsed}`);
        }
    }
}
