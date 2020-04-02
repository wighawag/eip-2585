Minimal Forwarder :

- EIP-1271 / EIP-1654 for Account contract delegation
    CONS :
        - add from in signed message and data
        - add signatureType
    PROS:
        - allow account contract to use same mechanism and benefit for anything built on top

- msg.value 
    CONS:
        - add value in signed message (not in data)
    PROS:
        - allow meta tx to send ETH.
            Note : Meta tx processor built on top can ensure relayer is rewarded for it (via token exchange for example)

- flexible nonce (replay protection)
    CONS:
        - add nonceStrategy contract address in signed message and data
        - make nonce a `bytes`
    PROS:
        - can have more flexible or cheaper (in gas) replay protection

- support building on top with one sig
    CONS:
        - add extraDataHash
    PROS:
        - only one sig reduce overhead
        - easier to support for wallet

- fork protection (chainId)
    CONS:
        - add chainId in signed message (not in data, unless it want to support past chainId, see below)
    PROS:
        - When a fork happen, user can decide to not send their meta tx to fork with different chainId

- fork transition protection 
    CONS:
        - add chainId in signed message and data
    PROS:
        - when a fork happen, any meta tx submitted before the fork remains valid in both

- EIP-712
    CONS:
        - add overhead (compleixity and operations)
    PROS: 
        - show a default message display for wallet that do not support the forwarder standard but support EIP-712
            Note: Meta tx processor built on top will not be able to shows their parameter via default EIP-712 support (uses extraDataHash)

- batch capability
    CONS:
        - add a function batch
    PROS:
        - allow to support batch transaction like `approve` and `call` allowing to support seamless ERC20 payment
    