# EIP-2585 Minimal Meta Transaction Forwarder + EIP-1776 Add-On Demo

The demo is located here: [https://metatx.eth.link](https://metatx.eth.link). It was originally made for the [Metamask](https://metamask.io) / [Gitcoin](https://gitcoin.co/) ["Take Back The Web Hackathon"](https://gitcoin.co/issue/MetaMask/Hackathons/2/3865) for which it win the competition.

It now has been expanded after further discussion with some of the other participants. In particular it expands on the idea proposed by Patrick McCorry to implement a minimal meta transaction forwarder with flexible replay protection (see [tweet](https://twitter.com/paddypisa/status/1245007740927381505)).

The demo itself show that such system is possible and compatible with more complex solution built on top:

That demo implements EIP-1776 (slightly modified, going to update the EIP soon) on top of it

## EIP-2585 The Minimal Forwarder

This minimal forwarder is described in [EIP-2585](https://github.com/wighawag/EIPs/blob/eip-2585/EIPS/eip-2585.md)

It implement a barebone though powerful base layer to implement more complex relaying mechanism on top. Contract that want to receive meta transaction just need to check that `msg.sender == address(forwarder)` and extract the address from the 20 bytes appended to call data. More complex relaying mechanism can be implemented without requiring change in meta transaction receiver. The demo showcase it with [EIP-1776](https://github.com/ethereum/EIPs/issues/1776) but system like [GSN](https://gsn.openzeppelin.com) can be implemented too.


In particular the minimal forward does not implement relayer repayment mechanism but can support it at a higher level. It simply ensure valid signer and replay protection.

Here are the current features :

| Feature | Done | Pros | Cons | Notes |
| :---  | :---: |  :--- | :--- | ---: |
| EIP-1271 / EIP-1654                  | &#x2714; | - allow account contract to use same mechanism and benefit for anything built on top | - add from in signed message and data | 
|                                      |          |  | - add signatureType |
| |
| msg.value                            | &#x2714; | - allow meta tx to send ETH | - add value in signed message (not in data) | Meta tx processor built on top can ensure relayer is rewarded for it (via token exchange for example) |
| |
| flexible replay protection           | &#x2714; | - can have more flexible or cheaper (in gas) replay protection | - add replayProtection contract address in signed message and data |
|                                      | | | - make nonce a `bytes` |
| |
| support building on top with one sig | &#x2714; | - only one sig reduce overhead | - add innerMessageHash |
|                                      | | - easier to support for walle | |
| |
| fork protection (chainId)            | &#x2714; | - add chainId in signed message (not in data, unless it want to support past chainId, see below) | - When a fork happen, user can decide to not send their meta tx to fork with different chainId |
| |
| fork transition protection           | | - add chainId in signed message and data | - when a fork happen, any meta tx submitted before the fork remains valid in both | Need to add chainId cache or better use EIP-1965 (not yet in) |
| |
| EIP-712                              | &#x2714; | - show a default message display for wallet that do not support the forwarder standard but support EIP-712 | - add overhead (compleixity and operations) | Meta tx processor built on top will not be able to shows their parameter via default EIP-712 support (uses innerMessageHash) |
| |
| Basic Signature                      | &#x2714; | - simpler | - does not have nice default display | Meta tx processor built on top will not be able to display their info neither (uses innerMessageHash) |
| |
| batch capability                     | &#x2714; | - allow to support batch transaction like `approve` and `call` allowing to support seamless ERC20 payment | - add a function batch |



## EIP-1776 implemented on top of the forwarder

EIP-1776 is a full solution for meta-tx including relayer repayment that provides safety guarantees for both relayers and signers

It now use EIP-2585 Forwarder for signature verification by using the `innerMessageHash` parameter allowing the EIP-712 message format to be embedded in the EIP-2585 message.

Every recipient contract supporting EIP-2585 (which only use the basic `_getTxSigner()` mechanism though 20bytes appended to the call) can receive EIP-1776 Meta Transaction

Contrary to earlier version, it removes support for ERC20 transfer as the same can be achieved through batch call that EIP-2585 support.

Use can now transact with ERC-20 by doing an approve and call this way


EIP-1776 distinctive features are as follow :

*   Recipient do not need to be modified. They just need to support EIP-2585.
*   Supports Relayer refund in any ERC-20 tokens
*   By using EIP-2585 batch feature token transfer can be perform with a simultaneous approval. This means you will not need any pre-approval step anymore, for ERC20 contract that support EIP-2585;
*   Allow you to specify an expiry time (combined with [EIP-1681](https://eips.ethereum.org/EIPS/eip-1681), this allow relayer and user to ensure they get their tx in or not after a certain time, no more guessing)
*   Ensure the user its tx will be executed with the specific gas specified (though [EIP-1930](https://eips.ethereum.org/EIPS/eip-1930) would be better). While an obvious feature, this has been badly implemented in almost all other meta transaction implementation out there, including GSN and Gnosis Safe (see [https://github.com/gnosis/safe-contracts/issues/100](https://github.com/gnosis/safe-contracts/issues/100)).
*   Can provide a mechanism by which relayer / user can coordinate to ensure no 2 relayer submit the same meta-tx at the same time at the expense of one)
*   Use the flexible replay protection of EIP-2585 which by default use 2 dimensional nonce allowing to group transaction in or out of order. This allow user to for example make a ordered batch of transaction in one application and still remains able to do another ordered batch in another application.


## Implementation Choices

We can categorize meta-transaction support in at least, 6 different dimensions and here we will examine for each, the reasoning behind the choice

### A) Type of implementation

There are roughly 4 type of implementation

*   **Account-contract Based** (a la Gnosis Safe, etc…) where recipient do not need any modification but that require user to get a deployed account contract.
*   **Singleton Proxy** where the recipient simply need to check for the singleton address and where all the logic of meta transaction is implemented in the singleton. It can support charging with tokens and even provide token payments
*   **Token Proxy** where the recipient simply need to check for the token address and where all the logic of meta transaction is implemented in the token. This is the approach originally taken by @austingriffith in “Native Meta Transaction”. It is usually limited to be used for meta-tx to be paid in the specific token. Relayer would then need to trust each token for repayment.
*   **No Proxy** where the recipient is the meta-tx processor itself and where all the logic get implemented. While it can support relayer repayment, relayer would have to somehow trust each recipient implementation.

Since [EIP-1776](https://github.com/ethereum/EIPs/issues/1776) use EIP-2585, EIP-1776 follows the SIngleton proxy. This is good for the following reason :

*   we want to support EOA signer so Account-contract is not an option
*   The whole meta-tx intricacies can be solved in one contract
*   Users and Relayers (that expect refund) only need to trust one implementation

### B) Relayer refund

Another differentiation is the ability of relayer to get paid.

In our opinion, It is such an important feature for relayers that we should ensure it is at least possible to implement it on top, if not already present.

In that regard one thing that becomes important as soon as a relayer get paid, is that there is a mechanism to ensure the relayer cannot make the meta-tx fails. hence the need for txGas in [EIP-1776](https://github.com/ethereum/EIPs/issues/1776).

Another important EIP that would help here is [EIP-1930](https://eips.ethereum.org/EIPS/eip-1930) as the EVM call have poor support for passing an exact amount of gas to a call.

It is also worth noting the importance of the `baseGas` parameter here too, as this make our implementation independent of opcode pricing while ensuring the relayer can account for the extra gas required to execute the meta transaction processing cost.

### C) Token Transfer / Approval

While an earlier version of EIP-1776 supported token transfer as primitive, the latest does not as the same can be achieved with batch meta transaction that EIP-2585 supports. See demo.

### D) MetaTx Signer Verification

Another differentiation possible for non-account based meta transaction is how the signer is being picked up by the recipient.

An earlier version of EIP-1776 was using the first parameter as it was easy to support, but the appending of signer data at the end of the call data is more generic and is what EIP-2585 uses.

### E) meta tx failure responsibility

Earlier meta tx implementation assumed that the relayer was responsible of ensuring that the meta transaction call would not fails. So that when it fails, the whole tx would revert and the relayer would not get its refund if any.

This is in our opinion, not a great idea as this complexify the role of the relayer, since it has to guess whether the meta-tx call will not fails for reason out of its knowledge.

As such, we decided to add the `txGas` parameter that dictate how much gas need to be passed into the meta-tx call. If not enough is passed in the relayer's tx revert, causing relayer to lose its gas.

While this seems trivial to implement, this is not the case and almost every meta transaction implementation out there fails to implement it properly

They all seems to believe that the gas parameter passed to the various CALL opcode are a specific gas amount. This is not the case and the gas value only act as a maximum value unfortunately. To my knowledge, we are the first to implement correctly. Unfortunately in order to remain opcode pricing independent we relies on the specific behavior of [EIP-150](https://eips.ethereum.org/EIPS/eip-150) 63/64 rules to do so. The proper way to fix it for all meta transaction implementation would be to get [EIP-1930](https://eips.ethereum.org/EIPS/eip-1930) accepted in the next hard fork.

### F) Replay Protection Mechanism

As show [here](https://github.com/PISAresearch/metamask-comp), there are different replay protection mechanism with each their pros and cons.
EIP-2586 is very flexible for that. User can choose different mechanism by simply specifying the contract in charge of replay protection. EIP-1776 inherit it.

## Batching call in one meta-tx

Since EIP-1776 is based on EIP-2585, it automatically support Meta Transaction Batching.

## Multi Relayer Coordination

In order to avoid the possibilities of relayers submitting 2 meta-tx with the same nonce, at the expense of the relayer getting its tx included later, the proposal offer a mechanism to avoid it.

Every meta-tx can include a relayer field. This field has 2 purpose, the obvious one is to limit the message to be used by a specific relayer. the second is to ensure the relayer that if the tx get included it get a reward for inclusion

Relayer can thus reject any meta-tx that do not specify their relayer address so that user are incentivized to only submit one tx at a time, or run the risk of paying the cost of the extra relayed tx.

Of course, if the user got rid of its payment token as part of one of this competing tx, the user remains safe and one of the relayer will not get its refund, so this is not full proof.

Also this is not implemented in the demo nor in the code provided.
