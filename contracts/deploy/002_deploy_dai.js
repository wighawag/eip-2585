
module.exports = async ({getNamedAccounts, deployments}) => {
    const {deployIfDifferent, log} = deployments;
    const {deployer} = await getNamedAccounts();
    
    let contract = await await deployments.get('DAI');
    if (!contract) {
        const deployResult = await deployIfDifferent(['data'], "DAI",  {from: deployer, gas: 4000000}, "PAW", '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', '0x0000000000000000000000000000000000000000');
        contract = await await deployments.get('DAI');
        if(deployResult.newlyDeployed) {
            log(`DAI deployed at ${contract.address} for ${deployResult.receipt.gasUsed}`);
        }
    }
}
module.exports.tags = ['DAI'];