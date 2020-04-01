
module.exports = async ({namedAccounts, deployments}) => {
    const {deployIfDifferent, log} = deployments;
    const {deployer} = namedAccounts;

    let contract = deployments.get('EIP1776ForwarderWrapper');
    if (!contract) {
        const EIP712Forwarder = deployments.get('EIP712Forwarder');
        const deployResult = await deployIfDifferent(['data'], "EIP1776ForwarderWrapper",  {from: deployer, gas: 4000000}, "EIP1776ForwarderWrapper", EIP712Forwarder.address);
        contract = deployments.get('EIP1776ForwarderWrapper');
        if(deployResult.newlyDeployed) {
            log(`EIP1776ForwarderWrapper deployed at ${contract.address} for ${deployResult.receipt.gasUsed}`);
        }
    }
}
module.exports.tags = ['EIP1776ForwarderWrapper'];
module.exports.dependencies = ['EIP712Forwarder']