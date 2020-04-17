
module.exports = async ({getNamedAccounts, deployments}) => {
    const {deployIfDifferent, log} = deployments;
    const {deployer} = await getNamedAccounts();

    let processor = await deployments.get('EIP712Forwarder');
    let eip1776 = await deployments.get('EIP1776ForwarderWrapper');
    let numbers = await deployments.get('Numbers');
    let mtx = await deployments.get('MTX');
    let contract = await deployments.getOrNull('MTXNumberSale');
    if (!contract) {
        const deployResult = await deployIfDifferent(['data'], "MTXNumberSale",  {from: deployer, gas: 4000000}, "NumberSale", numbers.address, mtx.address, '1000000000000000000', processor.address, eip1776.address);
        contract = await deployments.get('MTXNumberSale');
        if(deployResult.newlyDeployed) {
            log(`MTXNumberSale deployed at ${contract.address} for ${deployResult.receipt.gasUsed}`);
        }
    }
}
// module.exports.skip = async () => true;