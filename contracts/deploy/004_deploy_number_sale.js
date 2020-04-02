
module.exports = async ({namedAccounts, deployments}) => {
    const {deployIfDifferent, log} = deployments;
    const {deployer} = namedAccounts;

    
    let processor = deployments.get('EIP712Forwarder');
    let eip1776 = deployments.get('EIP1776ForwarderWrapper');
    let numbers = deployments.get('Numbers');
    let dai = deployments.get('DAI');
    let contract = deployments.get('NumberSale');
    if (!contract) {
        const deployResult = await deployIfDifferent(['data'], "NumberSale",  {from: deployer, gas: 4000000}, "NumberSale", numbers.address, dai.address, '1000000000000000000', processor.address, eip1776.address);
        contract = deployments.get('NumberSale');
        if(deployResult.newlyDeployed) {
            log(`NumberSale deployed at ${contract.address} for ${deployResult.receipt.gasUsed}`);
        }
    }
}