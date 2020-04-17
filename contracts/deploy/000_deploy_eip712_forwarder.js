
module.exports = async ({getNamedAccounts, deployments}) => {
    const {deployIfDifferent, log} = deployments;
    const {deployer} = await getNamedAccounts();

    let contract = await deployments.getOrNull('EIP712Forwarder');
    if (!contract) {
        
        let deployResult;
        try {
            deployResult = await deployIfDifferent(['data'], "EIP712Forwarder",  {from: deployer, gas: 4000000}, "EIP712Forwarder");
        } catch (e) {
            console.error('cannot deploy', e);
            throw e;
        }
        contract = await deployments.get('EIP712Forwarder');
        if(deployResult.newlyDeployed) {
            log(`EIP712Forwarder deployed at ${contract.address} for ${deployResult.receipt.gasUsed}`);
        }
    }
}
module.exports.tags = ['EIP712Forwarder'];