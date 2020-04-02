
module.exports = async ({namedAccounts, deployments}) => {
    const {deployIfDifferent, log} = deployments;
    const {deployer} = namedAccounts;

    let processor = deployments.get('EIP712Forwarder');
    let eip1776 = deployments.get('EIP1776ForwarderWrapper');
    let contract = deployments.get('MTX');
    if (!contract) {
        const deployResult = await deployIfDifferent(['data'], "MTX",  {from: deployer, gas: 4000000}, "MTX", '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', processor.address, eip1776.address);
        contract = deployments.get('MTX');
        if(deployResult.newlyDeployed) {
            log(`MTX deployed at ${contract.address} for ${deployResult.receipt.gasUsed}`);
        }
    }
}
// module.exports.skip = async () => true;