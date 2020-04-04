<script>
import wallet from '../stores/wallet';
import metatx from '../stores/metatx';
import relayer from '../stores/relayer';
import MessageBox from '../components/MessageBox';
import SettingsOption from '../components/SettingsOption';
import WalletWrapper from '../components/WalletWrapper';
import account from '../stores/account';
import * as ethers from 'ethers';
import {pause} from '../utils/time'
import {TypedDataUtils} from 'eth-sig-util';
const zeroAddress = '0x0000000000000000000000000000000000000000';

const { Wallet, Contract, BigNumber, AbiCoder } = ethers;

let purchase_value = 0;
let purchase_expiry = 1610600198;
let purchase_txGas = 1000000;
let purchase_batchId = 0;
let purchase_nonce = null;
let purchase_tokenGasPrice = 0;
let purchase_relayer = "0x0000000000000000000000000000000000000000";

let transfer_value = 0;
let transfer_expiry = 1610600198;
let transfer_txGas = 1000000;
let transfer_batchId = 0;
let transfer_nonce = null;
let transfer_tokenGasPrice = 0;
let transfer_relayer = "0x0000000000000000000000000000000000000000";


let transferTo;


async function relay() {

}
function errorToAscii(str1) {
	const l = 64 + 64 + 10;
	if (str1.length <= l) {
		return "UNKNOWN ERROR (could be an OUT OF GAS error, check txGas value)";
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
	calls[0].value = 0;
	return sendMetaTx(calls, {
		batchId: transfer_batchId,
		batchNonce: transfer_nonce,
		value: transfer_value
	},
	{
		tokenContractName: 'MTX',
		expiry: transfer_expiry,
		txGas: transfer_txGas,
		tokenGasPrice: BigNumber.from(transfer_tokenGasPrice * 1000000000).mul('1000000000').toString(), // TODO use decimals
		relayerAddress: transfer_relayer,
	});
}


async function purchaseNumber() {
	const saleAddress = wallet.getContract('MTXNumberSale').address;
	const approvalCall = await wallet.computeData('MTX', 'approve', saleAddress, '10000000000000000000');
	approvalCall.value = 0;
	const purchaseCall = await wallet.computeData('MTXNumberSale', 'purchase', $wallet.address, $wallet.address);
	purchaseCall.value = 0;
	const calls = [approvalCall, purchaseCall];
	return sendMetaTx(calls, {
		batchId: purchase_batchId,
		batchNonce: purchase_nonce,
		value: purchase_value
	},
	{
		tokenContractName: 'MTX',
		expiry: purchase_expiry,
		txGas: purchase_txGas,
		tokenGasPrice: BigNumber.from(purchase_tokenGasPrice * 1000000000).mul('1000000000').toString(), // TODO use decimals
		relayerAddress: purchase_relayer,
	});
}

async function sendMetaTx(calls, {batchId, batchNonce, value}, {tokenContractName, expiry, txGas, baseGas, tokenGasPrice, relayerAddress}) {
	value = value || 0;

	if (value != 0 && value != '0') {
		$metatx = {status: 'error', message: 'Relayer will not execute it as msg.value > 0'};
		return false;
	} 

	const tokenContract = wallet.getContract(tokenContractName).address;
	
	const EIP1776ForwarderWrapperContract = wallet.getContract('EIP1776ForwarderWrapper');
    const meta_transaction = await wallet.computeData('EIP712Forwarder', 'batch', calls);

	batchNonce = batchNonce ? BigNumber.from(batchNonce) : await wallet.call('EIP712Forwarder', 'getNonce', $wallet.address, batchId);
	const nonce = batchNonce.add(BigNumber.from(batchId).mul(BigNumber.from(2).pow(128)));
	
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
	  value,
	  chainId: relayer.getChainIdToUse(),
	  replayProtection: zeroAddress, 
	  nonce: ethers.utils.defaultAbiCoder.encode(['uint256'], [nonce]),
	  data: meta_transaction.data,
	  innerMessageHash: wrapper_hash
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
				{name: 'value', type: 'uint256'},
				{name: 'chainId', type: 'uint256'},
				{name: 'replayProtection', type: 'address'},
				{name: 'nonce', type: 'bytes'},
				{name: 'data', type: 'bytes'},
				{name: 'innerMessageHash', type: 'bytes32'},
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
		$metatx = {status: 'error', message: 'Relayer will not execute it as the message is destined to another relayer'};
		return false;
	} 

	if(wrapper_message.expiry <  Date.now() /1000 ) {
		$metatx = {status: 'error', message: 'Relayer will not execute it as the expiry time is in the past'};
		return false;
	}else if(wrapper_message.expiry <  Date.now() / 1000 - 60) {
		$metatx = {status: 'error', message: 'Relayer will not execute it as the expiry time is too short'};
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
			{gasLimit: BigNumber.from('2000000'), chainId: relayer.getChainIdToUse(), value: BigNumber.from(value)}
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


<svelte:head>
	<title>Meta Tx Demo</title>
</svelte:head>

<div class="md:flex md:items-center md:justify-between m-5">
	<div class="flex-1 min-w-0">
		<h2 class="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:leading-9 sm:truncate">
			EIP-2585 + EIP-1776 Meta Transaction Demo
		</h2>
	</div>
</div>

<div class="bg-gray-200 overflow-hidden rounded-lg">
	<div class="px-4 py-5 sm:p-6">	
		<p>This demo showcase the benefit of EIP-2585 and EIP-1776 standards and how they can be set up to provide a seamingless experience to user without ether. More details <a class="underline" href="about">here</a>.</p>		
	</div>
</div>



<WalletWrapper>
	{#if $account.status == 'Loading'}
		<p> fetching account info </p>
	{:else if $account.status == 'Loaded'}
		<div class="bg-gray-200 overflow-hidden rounded-lg mt-5 my-5">
			<div class="px-4 py-5 sm:p-6">
				<p>MTX is a token that support EIP-2585 and has pre-approved EIP-1776 preprocessor to allow user to pay gas in MTX. MTX can thus be used without any extra step. You can even start interacting with contracts that support the standard and they can even charge tokens (no pre-approval required!).</p>
			</div>
		</div>

		<div class="bg-white shadow overflow-hidden sm:rounded-lg">
			<div class="px-4 py-5 sm:p-0">
				<dl>
				  <div class="sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6 sm:py-5">
					<dt class="text-sm leading-5 font-medium text-gray-500">
						Your MTX Balance:
					</dt>
					<dd class="mt-1 text-sm leading-5 text-gray-900 sm:mt-0 sm:col-span-2">
						{$account.mtxBalance.div('1000000000000000') / 1000}
					</dd>
				  </div>
				</dl>
			</div>
		</div>

		<div class="bg-gray-200 overflow-hidden rounded-lg my-5">
			<div class="px-4 py-5 sm:p-6">
				<p>Here, for example, you can send a meta transaction to a NFT sale contract that will charge you 1 MTX in exchange of an NFT</p>
			</div>
		</div>
		
		<div class="bg-white shadow sm:rounded-lg">
			<div class="text-center">
				<span class="inline-flex rounded-md shadow-sm">
					<button on:click="{() => purchaseNumber()}" type="button" class="inline-flex items-center px-4 py-2 border border-transparent text-base leading-6 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:border-indigo-700 focus:shadow-outline-indigo active:bg-indigo-700 transition ease-in-out duration-150">
						buy an NFT for 1 MTX
					</button>
				</span>
			</div>

			<details class="mb-10">
				<summary>advanced Meta Tx settings</summary>
				<div class="mt-6 sm:mt-5">
					<SettingsOption label="expiry" type="datetime" bind:value={purchase_expiry}/>
					<SettingsOption label="txGas" type="number" bind:value={purchase_txGas}/>
					<SettingsOption label="batchId" type="number" bind:value={purchase_batchId}/>
					<SettingsOption label="nonce" type="number" bind:value={purchase_nonce}/>
					<SettingsOption label="value" type="datetime" bind:value={purchase_value}/>
					<SettingsOption label="tokenGasPrice" type="number" bind:value={purchase_tokenGasPrice}/>
					<SettingsOption label="relayer" type="string" bind:value={purchase_relayer}/>
				</div>
			</details>
		</div>
		
		<div>
			<div>
			  <h3 class="text-lg leading-6 font-medium text-gray-900">
				Your NFTs below
			  </h3>
			  <p class="max-w-2xl text-sm leading-5 text-gray-500">
				(only show 11 max)
			  </p>
			</div>
			<div class="mt-5 border-t border-gray-200 pt-5">
				<ul>
					{#each $account.numbers as item}
						<li>{item}</li>
					{:else}
					<p>You do not own any Number NFT yet!</p>
					{/each}
				</ul>
			</div>
		</div>
		
		{#if $account.numbers.length}
		<div class="bg-gray-200 overflow-hidden rounded-lg my-5">
			<div class="px-4 py-5 sm:p-6">
				<p>Here you can send a meta transaction to the NFT (ERC721) contract to transfer your token. (no need of MTX, unless you need to pay the relayer, see advanced settings))</p>
			</div>
		</div>

		<div class="bg-white shadow sm:rounded-lg">
			<div class="px-4 py-5 sm:p-6 items-center text-center">
				<h3 class="text-lg leading-6 font-medium text-gray-900">
					Transfer NFTs
				</h3>
				<p>
					Transfer NFT "{$account.numbers[0]}" to another account.
				</p>
				<label for="address" class="sr-only">Destination address</label>
				<div class="relative rounded-md shadow-sm inline-block m-5">
					<input id="address" bind:value={transferTo} class="form-input inline sm:text-sm sm:leading-5" placeholder="address" />
				</div>
				<p></p>
				<span class="mt-3 inline-flex rounded-md shadow-sm sm:mt-0 sm:ml-3 sm:w-auto">
					<button on:click="{() => transferFirstNumber()}" type="button" class="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-500 focus:outline-none focus:border-indigo-700 focus:shadow-outline-indigo active:bg-indigo-700 transition ease-in-out duration-150 sm:w-auto sm:text-sm sm:leading-5">
						Transfer NFT "{$account.numbers[0]}"
					</button>
				</span>
			</div>

			<details class="mb-10">
				<summary>advanced Meta Tx settings</summary>
				<div class="mt-6 sm:mt-5">
					<SettingsOption label="expiry" type="datetime" bind:value={transfer_expiry}/>
					<SettingsOption label="txGas" type="number" bind:value={transfer_txGas}/>
					<SettingsOption label="batchId" type="number" bind:value={transfer_batchId}/>
					<SettingsOption label="nonce" type="number" bind:value={transfer_nonce}/>
					<SettingsOption label="value" type="datetime" bind:value={transfer_value}/>
					<SettingsOption label="tokenGasPrice" type="number" bind:value={transfer_tokenGasPrice}/>
					<SettingsOption label="relayer" type="string" bind:value={transfer_relayer}/>
				</div>
			</details>
		</div>
		{/if}
	{:else if $account.status == 'Unavailable'}
	<MessageBox> Please wait... <!--unlock account--> </MessageBox> <!-- temporary state, TODO synchronise flow -->
	{:else}
	<MessageBox> ERROR </MessageBox>
	{/if}
	
</WalletWrapper>


