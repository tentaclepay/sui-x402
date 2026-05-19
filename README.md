# `@tentaclepay/sui-x402`

Sui implementation of the x402 payment protocol using the **Exact** payment scheme.

## Installation

```bash
npm install @tentaclepay/sui-x402
```

## Overview

This package provides three main components for handling x402 payments on Sui-compatible blockchains:

- **Client** - For applications that need to make payments (have wallets/signers)
- **Facilitator** - For payment processors that verify and execute on-chain transactions
- **Service** - For resource servers that accept payments and build payment requirements

## Package Exports

### Main Package (`@tentaclepay/sui-x402`)

**V2 Protocol Support** - Modern x402 protocol with CAIP-2 network identifiers

**Client:**
- `ExactSuiClient` - V2 client implementation using EIP-3009
- `toClientSuiSigner(keypair)` - Converts Sui keypair to x402 signers
- `ClientSuiSigner` - TypeScript type for client signers

**Facilitator:**
- `ExactSuiFacilitator` - V2 facilitator for payment verification and settlement
- `toFacilitatorSuiSigner(wallet)` - Converts Sui keypair to facilitator signers
- `FacilitatorSuiSigner` - TypeScript type for facilitator signers

**Service:**
- `ExactSuiServer` - V2 service for building payment requirements
