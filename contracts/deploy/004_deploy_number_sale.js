
module.exports = async ({getNamedAccounts, deployments}) => {
    const {deployIfDifferent, log} = deployments;
    const {deployer} = await getNamedAccounts();

    
    let processor = await await deployments.get('EIP712Forwarder');
    let eip1776 = await await deployments.get('EIP1776ForwarderWrapper');
    let numbers = await await deployments.get('Numbers');
    let dai = await await deployments.get('DAI');
    let contract = await await deployments.get('NumberSale');
    if (!contract) {
        const deployResult = await deployIfDifferent(['data'], "NumberSale",  {from: deployer, gas: 4000000}, "NumberSale", numbers.address, dai.address, '1000000000000000000', processor.address, eip1776.address);
        contract = await await deployments.get('NumberSale');
        if(deployResult.newlyDeployed) {
            log(`NumberSale deployed at ${contract.address} for ${deployResult.receipt.gasUsed}`);
        }
    }
}