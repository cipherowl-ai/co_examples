# CipherOwl x402 Screening Client

A TypeScript client for CipherOwl's x402-protected blockchain address screening API.

Uses the official [x402-fetch](https://www.npmjs.com/package/x402-fetch) package to handle the x402 payment protocol automatically.

## Features

- **Official x402 integration** - Uses the standard x402-fetch package
- **Automatic payments** - Handles 402 Payment Required flow automatically
- **Multi-chain screening** - Screen addresses on EVM, Bitcoin, Solana, Tron
- **Type-safe** - Full TypeScript support

## Quick Start

```bash
# Install dependencies
bun install
# or: npm install

# Set your private key (must have USDC on Base mainnet)
export EVM_PRIVATE_KEY=0x...

# Run the example
bun run example
# or: npx ts-node index.ts
```

## Usage

### Basic Screening

```typescript
import { X402Client } from "./client";

const client = await X402Client.create({
  evmPrivateKey: process.env.EVM_PRIVATE_KEY as `0x${string}`,
  network: "base", // Production uses Base mainnet
  maxPayment: BigInt(1_000_000), // 1.00 USDC max (screening costs $0.50)
});

// Screen an address
const result = await client.screenAddress(
  "https://api.cipherowl.ai",
  "evm",
  "0x3fdee07b0756651152bf11c8d170d72d7ebbec49",
  "co-high_risk_ext_hops_2"
);

console.log(result.data);
// {
//   chain: "evm",
//   address: "0x3fdee07b...",
//   foundRisk: true,
//   riskScore: 85
// }
```

### Generic Request

```typescript
// Make any x402-protected request
const result = await client.request(
  "https://api.cipherowl.ai/api-402/screen/v1/chains/evm/addresses/0x..."
);
```

### Error Handling

```typescript
try {
  const result = await client.screenAddress(
    "https://api.cipherowl.ai",
    "evm",
    address,
    "co-high_risk_ext_hops_2"
  );
  console.log(result.data);
} catch (error) {
  if (error.message.includes("Payment amount exceeds")) {
    console.error("Payment too high - increase maxPayment option");
  } else if (error.message.includes("insufficient_funds")) {
    console.error("Wallet needs more USDC on Base mainnet");
  } else {
    console.error("Screening failed:", error.message);
  }
}
```

## Configuration

| Option          | Required | Default               | Description                       |
| --------------- | -------- | --------------------- | --------------------------------- |
| `evmPrivateKey` | Yes      | -                     | Your wallet private key           |
| `network`       | No       | `base`                | Settlement network (Base mainnet) |
| `maxPayment`    | No       | `1000000` (1.00 USDC) | Maximum payment in base units     |
| `logger`        | No       | -                     | Logger for debugging              |

## Environment Variables

```bash
EVM_PRIVATE_KEY=0x...              # Required: Your wallet private key
API_URL=https://api.cipherowl.ai   # Optional: API endpoint (default)
NETWORK=base                       # Optional: base (default) or base-sepolia
MAX_PAYMENT=1000000                # Optional: Max payment in USDC base units
```

## How x402 Works

1. **Request** - Client makes request to x402-protected endpoint
2. **402 Response** - Server returns 402 Payment Required with payment details
3. **Payment** - x402-fetch automatically creates EIP-3009 signed payment
4. **Retry** - Request retried with X-PAYMENT header
5. **Response** - Server verifies payment and returns data

## Supported Chains for Screening

| Chain   | Identifier | Example         |
| ------- | ---------- | --------------- |
| EVM     | `evm`      | `0x3fdee07b...` |
| Bitcoin | `bitcoin`  | `1A1zP1eP5Q...` |
| Solana  | `solana`   | `7EqQdEUfQq...` |
| Tron    | `tron`     | `TYASr5UV6H...` |

## Pricing

- Production screening: **$0.50 USDC** per address
- Payment network: **Base mainnet**
- Payment asset: **USDC** (0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)

## Security

- Never commit `.env` or private keys
- Use testnet (`base-sepolia`) with local server for development
- Keep wallet balances low

## License

MIT
