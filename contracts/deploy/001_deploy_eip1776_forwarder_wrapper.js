
module.exports = async ({getNamedAccounts, deployments}) => {
    const {deployIfDifferent, log} = deployments;
    const {deployer} = await getNamedAccounts();

    let contract = await deployments.getOrNull('EIP1776ForwarderWrapper');
    if (!contract) {
        const EIP712Forwarder = await deployments.get('EIP712Forwarder');
        const deployResult = await deployIfDifferent(['data'], "EIP1776ForwarderWrapper",  {from: deployer, gas: 4000000}, "EIP1776ForwarderWrapper", EIP712Forwarder.address);
        contract = await deployments.get('EIP1776ForwarderWrapper');
        if(deployResult.newlyDeployed) {
            log(`EIP1776ForwarderWrapper deployed at ${contract.address} for ${deployResult.receipt.gasUsed}`);
        }
    }
}
module.exports.tags = ['EIP1776ForwarderWrapper'];
module.exports.dependencies = ['EIP712Forwarder']