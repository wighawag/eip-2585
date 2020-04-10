
module.exports = async ({getNamedAccounts, deployments}) => {
    const {deployIfDifferent, log} = deployments;
    const {deployer} = await getNamedAccounts();

    let processor = await await deployments.get('EIP712Forwarder');
    let eip1776 = await await deployments.get('EIP1776ForwarderWrapper');
    let numbers = await await deployments.get('Numbers');
    let mtx = await await deployments.get('MTX');
    let contract = await await deployments.get('MTXNumberSale');
    if (!contract) {
        const deployResult = await deployIfDifferent(['data'], "MTXNumberSale",  {from: deployer, gas: 4000000}, "NumberSale", numbers.address, mtx.address, '1000000000000000000', processor.address, eip1776.address);
        contract = await await deployments.get('MTXNumberSale');
        if(deployResult.newlyDeployed) {
            log(`MTXNumberSale deployed at ${contract.address} for ${deployResult.receipt.gasUsed}`);
        }
    }
}
// module.exports.skip = async () => true;