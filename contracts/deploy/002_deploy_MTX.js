
module.exports = async ({getNamedAccounts, deployments}) => {
    const {deployIfDifferent, log} = deployments;
    const {deployer} = await getNamedAccounts();

    let processor = await await deployments.get('EIP712Forwarder');
    let eip1776 = await await deployments.get('EIP1776ForwarderWrapper');
    let contract = await await deployments.get('MTX');
    if (!contract) {
        const deployResult = await deployIfDifferent(['data'], "MTX",  {from: deployer, gas: 4000000}, "MTX", '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', processor.address, eip1776.address);
        contract = await await deployments.get('MTX');
        if(deployResult.newlyDeployed) {
            log(`MTX deployed at ${contract.address} for ${deployResult.receipt.gasUsed}`);
        }
    }
}
// module.exports.skip = async () => true;