<script>
import wallet from '../stores/wallet';
import metatx from '../stores/metatx';
import relayer from '../stores/relayer';
import WalletWrapper from '../components/WalletWrapper';
import account from '../stores/account';
import * as ethers from 'ethers';
import {pause} from '../utils/time'
import {TypedDataUtils} from 'eth-sig-util';
const zeroAddress = '0x0000000000000000000000000000000000000000';

const { Wallet, Contract, BigNumber, AbiCoder } = ethers;

let purchase_amount = 1;
let purchase_expiry = 1610600198;
let purchase_txGas = 1000000;
let purchase_batchId = 0;
let purchase_nonce = undefined;
let purchase_tokenGasPrice = 0;
let purchase_relayer = "0x0000000000000000000000000000000000000000";

let transfer_amount = 0;
let transfer_expiry = 1610600198;
let transfer_txGas = 1000000;
let transfer_batchId = 0;
let transfer_nonce = undefined;
let transfer_tokenGasPrice = 0;
let transfer_relayer = "0x0000000000000000000000000000000000000000";


let transferTo;


async function relay() {

}
function errorToAscii(str1) {
	const l = 64 + 64 + 10;
	if (str1.length <= l) {
		return "UNKNOWN ERROR";
	}
	str1 = str1.slice(l);
	let str = '';
	for (let n = 0; n < str1.length; n += 2) {
		str += String.fromCharCode(parseInt(str1.substr(n, 2), 16));
	}
	return str;
}
async function getEventsFromReceipt(ethersProvider, ethersContract, sig, receipt) {
    let topic = ethers.utils.id(sig);
    let filter = {
        address: ethersContract.address,
        fromBlock: receipt.blockNumber,
        toBlock: receipt.blockNumber,
        topics: [ topic ]
    }

    const logs = await ethersProvider.getLogs(filter);
    return logs.map(l => ethersContract.interface.parseLog(l));
}

async function transferFirstNumber() {
	const calls = [await wallet.computeData('Numbers', 'transferFrom', $wallet.address, transferTo, $account.numbers[0])];
	return sendMetaTx(calls, {
		batchId: transfer_batchId,
		batchNonce: transfer_nonce
	},
	{
		tokenContractName: 'DAI',
		expiry: transfer_expiry,
		txGas: transfer_txGas,
		tokenGasPrice: BigNumber.from(transfer_tokenGasPrice * 1000000000).mul('1000000000').toString(), // TODO use decimals
		relayerAddress: transfer_relayer,
	});
}

async function purchaseNumber() {
	const saleAddress = wallet.getContract('NumberSale').address;
	// const approvalCall = await wallet.computeData('DAI', 'approve', saleAddress, '10000000000000000000');
	// TODO support DAI via message in
	const purchaseCall = await wallet.computeData('NumberSale', 'purchase', $wallet.address, $wallet.address);
	const calls = [purchaseCall];
	return sendMetaTx(calls, {
		batchId: purchase_batchId,
		batchNonce: purchase_nonce
	},
	{
		tokenContractName: 'DAI',
		expiry: purchase_expiry,
		txGas: purchase_txGas,
		tokenGasPrice: BigNumber.from(purchase_tokenGasPrice * 1000000000).mul('1000000000').toString(), // TODO use decimals
		relayerAddress: purchase_relayer,
	});
}

async function permitDAI() {
	const dai = wallet.getContract('DAI');
	const numberSaleAddress = wallet.getContract('NumberSale').address;
	const nonce = await wallet.call('DAI', 'nonces', $wallet.address);
	const message = {
      holder: $wallet.address,
	  spender: numberSaleAddress,
	  nonce: nonce.toHexString(),
	  expiry: 0,
	  allowed: true
	};
	const msgParams = JSON.stringify({types:{
      EIP712Domain:[
        {name:"name",type:"string"},
		{name:"version",type:"string"},
		// {name:"chainId",type:"uint256"},
        {name:"verifyingContract",type:"address"}
      ],
      Permit:[
		{name:"holder",type:"address"},
		{name:"spender",type:"address"},
		{name:"nonce",type:"uint256"},
		{name:"expiry",type:"uint256"},
		{name:"allowed",type:"bool"}
      ],
    },
    primaryType:"Permit",
    domain:{name:"Dai Stablecoin",version:"1",verifyingContract: dai.address},
	message
	});
	
	let response;
	try {
		response = await wallet.sign(msgParams);
	} catch(e) {
		$metatx = {status: 'error', message: 'signature rejected'};
		return false;
	}
	if (!response) {
		$metatx = {status: 'error', message: 'signature rejected, no response'};
		return false;
	}
	$metatx = {status: 'submitting'};
	await pause(0.4);

	const splitSig = ethers.utils.splitSignature(response);

	const provider = relayer.getProvider();
	const relayerWallet = new Wallet($relayer.privateKey).connect(provider);
	const DAI = new Contract(dai.address, dai.abi, relayerWallet);

	const currentBalance = await provider.getBalance(relayerWallet.address);
	if (currentBalance.lt('1000000000000000')) {
		$metatx = {status: 'error', message: 'relayer balance too low, please send ETH to ' + relayerWallet.address};
		return false;     
	}

	$metatx = {status: 'waitingRelayer'};
	while($relayer.status != 'Loaded' && $relayer.status != 'Error') {
		await pause(1);
	}
	if ($relayer.status == 'Error') {
		$metatx = {status: 'error', message: $relayer.message};
		return false;
	}
	// await pause(0.4);

	const tx = await DAI.permit(
		message.holder,
		message.spender,
		message.nonce,
		message.expiry,
		message.allowed,
		splitSig.v,
		splitSig.r,
		splitSig.s,
		{gasLimit: BigNumber.from('1000000'), chainId: relayer.getChainIdToUse()}
	);

	$metatx = {status: 'txBroadcasted'};
	await pause(0.4);
	let receipt;
	try {
		receipt = await tx.wait();
	} catch(e) {
		// TODO error
		console.log(e);
		$metatx = {status: 'error', message: 'relayer tx failed'};
		return false;
	}
	console.log(receipt);
	account.refresh();
	$metatx = {status: 'txConfirmed'};
	while($account.blockNumber < receipt.blockNumber) {
		await pause(0.5);
	}
	$metatx = {status: 'none'};
	return receipt;
}

async function sendMetaTx(calls, {batchId, batchNonce}, {tokenContractName, expiry, txGas, baseGas, tokenGasPrice, relayerAddress}) {
	const tokenContract = wallet.getContract(tokenContractName).address;
	
	const EIP1776ForwarderWrapperContract = wallet.getContract('EIP1776ForwarderWrapper');
    const meta_transaction = await wallet.computeData('EIP712Forwarder', 'batch', calls);

	batchNonce = batchNonce ? BigNumber.from(batchNonce) : await wallet.call('EIP712Forwarder', 'getNonce', $wallet.address, batchId);
	const nonce = batchNonce; // TODO .add(batchId.mul(BigNumber.from(2).pow(128))) // TODO // for now only batch 0
	
	const wrapper_message = {
      txGas,
	  baseGas: baseGas || 100000,
	  expiry,
	  tokenContract,
	  tokenGasPrice,
	  relayer: relayerAddress,
	}
	const wrapper_hash = '0x' + TypedDataUtils.sign({
		types : {
        EIP712Domain: [
          {name: 'name', type: 'string'},
          {name: 'version', type: 'string'},
          {name: 'verifyingContract', type: 'address'}
        ],
        EIP1776_MetaTransaction: [
          {name: 'txGas', type: 'uint256'},
          {name: 'baseGas', type: 'uint256'},
          {name: 'expiry', type: 'uint256'},
          {name: 'tokenContract', type: 'address'},
          {name: 'tokenGasPrice', type: 'uint256'},
          {name: 'relayer', type: 'address'},
        ]
      },
      domain: {
        name: 'EIP-1776 Meta Transaction',
        version: '1',
        verifyingContract: EIP1776ForwarderWrapperContract.address
      },
	  primaryType: 'EIP1776_MetaTransaction',
	  message: wrapper_message
	}).toString('hex');

	const message = {
      from: $wallet.address,
	  to: meta_transaction.to,
	  chainId: relayer.getChainIdToUse(),
	  replayProtection: zeroAddress, 
	  nonce: ethers.utils.defaultAbiCoder.encode(['uint256'], [nonce]),
	  data: meta_transaction.data,
	  extraDataHash: wrapper_hash
	};
	const msgParams = JSON.stringify({
		types:{
			EIP712Domain:[
				{name:"name",type:"string"},
				{name:"version",type:"string"}
			],
			MetaTransaction:[
				{name: 'from', type: 'address'},
				{name: 'to', type: 'address'},
				{name: 'chainId', type: 'uint256'},
				{name: 'replayProtection', type: 'address'},
				{name: 'nonce', type: 'bytes'},
				{name: 'data', type: 'bytes'},
				{name: 'extraDataHash', type: 'bytes32'},
			],
    	},
		primaryType:"MetaTransaction",
		domain:{name:"Forwarder",version:"1"},
		message
	});
	
	let response;
	try {
		response = await wallet.sign(msgParams);
	} catch(e) {
		$metatx = {status: 'error', message: 'signature rejected'};
		return false;
	}
	if (!response) {
		$metatx = {status: 'error', message: 'signature rejected, no response'};
		return false;
	}
	
	$metatx = {status: 'submitting'};
	await pause(0.4);
	const provider = relayer.getProvider();
	const relayerWallet = new Wallet($relayer.privateKey).connect(provider);
	const metaTxProcessor = new Contract(EIP1776ForwarderWrapperContract.address, EIP1776ForwarderWrapperContract.abi, relayerWallet);

	const currentBalance = await provider.getBalance(relayerWallet.address);
	if (currentBalance.lt('1000000000000000')) {
		$metatx = {status: 'error', message: 'relayer balance too low, please send ETH to ' + relayerWallet.address};
		return false;     
	}

	$metatx = {status: 'waitingRelayer'};
	while($relayer.status != 'Loaded' && $relayer.status != 'Error') {
		await pause(1);
	}
	if ($relayer.status == 'Error') {
		$metatx = {status: 'error', message: $relayer.message};
		return false;
	}
	// await pause(0.4);
	if (wrapper_message.relayer.toLowerCase() != '0x0000000000000000000000000000000000000000' && wrapper_message.relayer.toLowerCase() != $relayer.address.toLowerCase()) {
		$metatx = {status: 'error', wrapper_message: 'Relayer will not execute it as the message is destined to another relayer'};
		return false;
	} 

	if(wrapper_message.expiry <  Date.now() /1000 ) {
		$metatx = {status: 'error', wrapper_message: 'Relayer will not execute it as the expiry time is in the past'};
		return false;
	}else if(wrapper_message.expiry <  Date.now() / 1000 - 60) {
		$metatx = {status: 'error', wrapper_message: 'Relayer will not execute it as the expiry time is too short'};
		return false;
	}

	const actualMetaNonce = await wallet.call('EIP712Forwarder', 'getNonce', $wallet.address, batchId);
	const expectedBatchNonce = actualMetaNonce.toHexString();
	if (expectedBatchNonce != batchNonce.toHexString()) {
		$metatx = {status: 'error', message: 'Relayer will not execute it as the message has the wrong nonce'};
		return false;
	}
	console.log(expectedBatchNonce, batchNonce);

	let tx 
	try {
		tx = await metaTxProcessor.functions.relay(
			message,
			0,
			response,
			wrapper_message,
			relayerWallet.address,
			{gasLimit: BigNumber.from('2000000'), chainId: relayer.getChainIdToUse()}
		);
	} catch(e) {
		// TODO error
		console.log(e);
		$metatx = {status: 'error', message: 'relayer tx failed at submission'};
		return false;
	}
	
	$metatx = {status: 'txBroadcasted'};
	await pause(0.4);
	let receipt;
	try {
		receipt = await tx.wait();
	} catch(e) {
		// TODO error
		console.log(e);
		$metatx = {status: 'error', message: 'relayer tx failed'};
		return false;
	}
	const metaTxEvent = receipt.events.find((event) => event.event === 'MetaTx' && event.address === metaTxProcessor.address);
	if (!metaTxEvent.args[1]){
		const errorString = errorToAscii(metaTxEvent.args[2]);
		$metatx = {status: 'error', message: 'MetaTx Mined but Error: ' + errorString};
		return false;
	}
	console.log(receipt);
	account.refresh();
	$metatx = {status: 'txConfirmed'};
	while($account.blockNumber < receipt.blockNumber) {
		await pause(0.5);
	}
	$metatx = {status: 'none'};
	return receipt;
}
</script>

<style>
	h1, figure, p {
		text-align: center;
		margin: 0 auto;
	}

	h1 {
		font-size: 2.8em;
		text-transform: uppercase;
		font-weight: 700;
		margin: 0 0 0.5em 0;
	}

	figure {
		margin: 0 0 1em 0;
	}

	img {
		width: 100%;
		max-width: 400px;
		margin: 0 0 1em 0;
	}

	p {
		margin: 1em auto;
	}

	.center {
		text-align:center;
	}

	@media (min-width: 480px) {
		h1 {
			font-size: 4em;
		}
	}
</style>

<svelte:head>
	<title>Meta Tx Demo</title>
</svelte:head>

<WalletWrapper>
    <h2 class="center">Meta Tx Demo</h2>
    <!-- <figure>
        <img alt='Borat' src='great-success.png'>
        <figcaption>HIGH FIVE!</figcaption>
    </figure> -->

	
	
	{#if $account.status == 'Loading'}
	<hr/>
    <span> fetching account info </span>
	<hr/>
	{:else if $account.status == 'Loaded'}
		
		{#if $account.hasApprovedNumberSaleForDAI}
		<hr/>
		<p>Congrats, you already authorized the Sale contract to handle DAI</p>
		<p>Your DAI Balance:</p>
		<hr/>
		<h3 class="center">{$account.daiBalance.div('1000000000000000') / 1000}</h3>
		<hr/>
		<p>Here, you can send a metatx to a NFT sale contract that expect to take from you 1 DAI in exchange of an NFT</p>
		<p><button on:click="{() => purchaseNumber()}">buy a Number for 1 DAI</button></p>
		<details>
			<summary>advanced Meta Tx settings</summary>
			<label>DAI amount</label><input type="number" bind:value={purchase_amount}/><br/>
			<label>expiry</label><input type="datetime" bind:value={purchase_expiry}/><br/>
			<label>txGas</label><input type="number" bind:value={purchase_txGas}/><br/>
			<label>batchId</label><input type="number" bind:value={purchase_batchId}/><br/>
			<label>nonce</label><input type="number" bind:value={purchase_nonce}/><br/>
			<label>tokenGasPrice</label><input type="number" bind:value={purchase_tokenGasPrice}/><br/>
			<label>relayer</label><input type="string" bind:value={purchase_relayer}/><br/>
		</details>
		{:else}
		<hr/>
		<p>Your DAI Balance:</p>
		<hr/>
		<h3 class="center">{$account.daiBalance.div('1000000000000000000')}</h3>
		<p>Since DAI was created before such proposal, you would need to first approve your token to be used by the meta transaction processor.
		Fortunately, DAI allow us to do that with a simple signature (via permit call)</p>
		<p><button on:click="{() => permitDAI()}">Approve Sale</button></p>
		{/if}
		<br/>
		<br/>
		<hr/>
		<p>Your Numbers NFT below (only show 11 max) :</p>
		<hr/>
		<ul>
		{#each $account.numbers as item}
			<li>{item}</li>
		{:else}
		<p>You do not own any Number NFT yet!</p>
		{/each}
		</ul>
		{#if $account.numbers.length}
		<hr/>
		<p>Transfer Number ({$account.numbers[0]}) to another account</p>
		<p>Here you can send a metatx to the NFT (ERC721) contract to transfer your token. (no need of DAI, unless you need to pay the relayer, see advanced settings)</p>
		<p><input placeholder="address" bind:value={transferTo}/></p>
		<p><button on:click="{() => transferFirstNumber()}">transfer</button></p>
		<details>
			<summary>advanced Meta Tx settings</summary>
			<label>DAI amount</label><input type="number" bind:value={transfer_amount}/><br/>
			<label>expiry</label><input type="datetime" bind:value={transfer_expiry}/><br/>
			<label>txGas</label><input type="number" bind:value={transfer_txGas}/><br/>
			<label>batchId</label><input type="number" bind:value={transfer_batchId}/><br/>
			<label>nonce</label><input type="number" bind:value={transfer_nonce}/><br/>
			<label>tokenGasPrice</label><input type="number" bind:value={transfer_tokenGasPrice}/><br/>
			<label>relayer</label><input type="string" bind:value={transfer_relayer}/><br/>
		</details>
		{/if}

		<!-- {#if $account.hasApprovedMetaTxProcessorForDAI}
		<hr/>
		<p>And you can of course transfer DAI</p>
		<p><input placeholder="address" bind:value={transferTo}/></p>
		<p><button on:click="{() => transferDAI()}">send 0.5 DAI to someone</button></p>
		<details>
			<summary>advanced Meta Tx settings</summary>
			<label>DAI amount</label><input type="number" bind:value={dai_transfer_amount}/><br/>
			<label>expiry</label><input type="datetime" bind:value={dai_transfer_expiry}/><br/>
			<label>txGas</label><input type="number" bind:value={dai_transfer_txGas}/><br/>
			<label>batchId</label><input type="number" bind:value={dai_transfer_batchId}/><br/>
			<label>nonce</label><input type="number" bind:value={dai_transfer_nonce}/><br/>
			<label>tokenGasPrice</label><input type="number" bind:value={dai_transfer_tokenGasPrice}/><br/>
			<label>relayer</label><input type="string" bind:value={dai_transfer_relayer}/><br/>
		</details>
		{/if} -->
	{:else if $account.status == 'Unavailable'}
	<span> please wait... <!--unlock account--> </span> <!-- temporary state, TODO synchronise flow -->
	{:else}
	<span> ERROR </span>
	{/if}
	
</WalletWrapper>


