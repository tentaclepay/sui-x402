# sui-x402

Sui implementation of the [x402 payment protocol](https://www.x402.org) across multiple languages.

## Packages

| Language | Package | Status |
|----------|---------|--------|
| [TypeScript](./typescript) | [`@tentaclepay/sui-x402`](https://www.npmjs.com/package/@tentaclepay/sui-x402) | Available |
| Go | `tentaclepay/sui-x402-go` | Coming soon |
| Java | `tentaclepay/sui-x402-java` | Coming soon |
| Python | `tentaclepay/sui-x402-python` | Coming soon |

## Overview

Each package provides the same three core components:

- **Client** — Makes payments on behalf of a wallet/signer
- **Facilitator** — Verifies and settles on-chain transactions
- **Server** — Builds payment requirements for resource servers
