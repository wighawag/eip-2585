Minimal Forwarder :

- EIP-1271 / EIP-1654 for Account contract delegation
    - add from in signed message and data
    - add signatureType

- msg.value 
    - add value in signed message (not in data)

- flexible nonce (replay protection)
    - add nonceStrategy contract address in signed message and data
    - make nonce a `bytes`

- support building on top with one sig
    - add extraDataHash

- fork protection (chainId)
    - add chainId in signed message (not in data, unless it want to support past chainId, see below)

- fork transition protection 
    - add chainId in signed message and data

- EIP-712
    - add overhead (compleixity and operations)
