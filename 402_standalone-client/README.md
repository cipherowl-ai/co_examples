# CipherOwl x402 Screening Client

A standalone example client for CipherOwl's x402-protected blockchain address screening API.

## Overview

This client demonstrates how to use the **x402 protocol** for micropayments to access CipherOwl's blockchain address screening service. The x402 protocol enables pay-per-use APIs using cryptocurrency (USDC) without requiring subscriptions or API keys.

### What is x402?

x402 is a protocol for HTTP micropayments. Instead of traditional authentication:
1. Client makes a request → Server responds with `402 Payment Required`
2. Client creates a cryptographic payment proof (EIP-3009 authorization)
3. Client retries with payment proof → Server verifies and responds

**Benefits:**
- ✅ No API keys or subscriptions
- ✅ Pay only for what you use
- ✅ Gasless payments (no blockchain transaction required)
- ✅ Instant settlement on-chain

## Quick Start

### 1. Install Dependencies

```bash
bun install
# or
npm install
```

### 2. Set Up Environment

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and set your private key
export EVM_PRIVATE_KEY=0xyour_private_key_here
```

### 3. Run the Example

```bash
bun run example
# or
npm run example
```

You should see:

```
🦉 CipherOwl x402 Screening Client

📦 Initializing X402Client
✅ Client ready
   Wallet:  0xYourAddress
   Network: base-sepolia
   API:     https://x402.cipherowl.ai

📤 Screening address...
   Chain:   evm
   Address: 0x3fdee07b0756651152bf11c8d170d72d7ebbec49
   Config:  co-high_risk_ext_hops_2

✅ Request completed in 1234ms

📊 Screening Results:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Chain:       evm
Address:     0x3fdee07b0756651152bf11c8d170d72d7ebbec49
Risk Found:  ✅ NO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎉 Screening complete!
```

## Usage

### Basic Example

```typescript
import { X402Client } from "./client";
import { baseSepolia } from "viem/chains";

// Initialize client
const client = new X402Client({
  evmPrivateKey: process.env.EVM_PRIVATE_KEY as `0x${string}`,
  network: baseSepolia,
});

// Screen an address (payment handled automatically!)
const result = await client.request(
  "https://x402.cipherowl.ai/api-402/screen/v1/chains/evm/addresses/0x..."
);

console.log(result.data);
```

### Screen Multiple Chains

```typescript
const chains = [
  { chain: "evm", address: "0x..." },
  { chain: "bitcoin", address: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa" },
  { chain: "solana", address: "7EqQdEUfQqo2gRKmJhZdCKQYqBbJmhPKqWHyLpHKcKHJ" },
];

for (const { chain, address } of chains) {
  const endpoint = `${apiUrl}/api-402/screen/v1/chains/${chain}/addresses/${address}`;
  const result = await client.request(endpoint);
  console.log(`${chain}: ${result.data.foundRisk ? 'RISK' : 'CLEAN'}`);
}
```

## API Reference

### X402Client

```typescript
class X402Client {
  constructor(options: {
    evmPrivateKey: `0x${string}`;  // Your wallet private key
    facilitatorUrl?: string;        // API base URL (default: https://x402.cipherowl.ai)
    network?: Chain;                // base or baseSepolia (default: base)
    rpcUrl?: string;                // Optional RPC endpoint
    logger?: Console;               // Optional logger
  });

  getAddress(): string;             // Get your wallet address

  async request<T>(                 // Make a request with automatic payment
    url: string,
    options?: RequestInit
  ): Promise<{
    data: T;
    status: number;
    headers: Headers;
  }>;
}
```

### Screening Endpoint

```
GET /api-402/screen/v1/chains/:chain/addresses/:address?config=:config
```

**Parameters:**
- `chain`: `evm`, `bitcoin`, `solana`, or `tron`
- `address`: Blockchain address to screen
- `config` (optional): Screening configuration

**Response:**
```json
{
  "chain": "evm",
  "address": "0x...",
  "foundRisk": false,
  "riskScore": 0,
  "config": "co-high_risk_ext_hops_2"
}
```

## Configuration

### Environment Variables

```bash
# Required
EVM_PRIVATE_KEY=0x...              # Your wallet private key

# Optional
API_URL=https://x402.cipherowl.ai  # API endpoint (default)
NETWORK=base-sepolia               # base or base-sepolia (default: base-sepolia)
RPC_URL=https://...                # Custom RPC endpoint
```

### Networks

- **base-sepolia**: Testnet (for development)
- **base**: Mainnet (for production)

Get testnet funds:
- Base Sepolia ETH: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet
- Base Sepolia USDC: Bridge from Sepolia or use faucets

## How It Works

### x402 Payment Flow

1. **Initial Request**
   ```
   GET /api-402/screen/v1/chains/evm/addresses/0x...
   ```

2. **Server Response (402 Payment Required)**
   ```json
   {
     "accepts": [{
       "scheme": "exact",
       "network": "base-sepolia",
       "maxAmountRequired": "10000",
       "payTo": "0x...",
       "asset": "0x036CbD...",
       "resource": "/api-402/screen/v1/..."
     }],
     "x402Version": 1
   }
   ```

3. **Client Creates Payment**
   - Creates EIP-3009 `TransferWithAuthorization` message
   - Signs with your private key (EIP-712 signature)
   - Encodes as base64

4. **Retry with Payment**
   ```
   GET /api-402/screen/v1/chains/evm/addresses/0x...
   Headers:
     X-PAYMENT: eyJ4NDAyVmVyc2lvbiI6MSwic2NoZW1lIjoiZXhhY3QiLCJuZXR3b3JrIjoiYmFzZS1zZXBvbGlhIiwicGF5bG9hZCI6eyJzaWduYXR1cmUiOiIweDAwMDAwMCIsImF1dGhvcml6YXRpb24iOnsic...
   ```

5. **Server Verifies and Responds**
   ```json
   {
     "chain": "evm",
     "address": "0x...",
     "foundRisk": false
   }
   ```

### EIP-3009: TransferWithAuthorization

The payment proof uses EIP-3009, which allows gasless USDC transfers:

```typescript
{
  from: "0xYourAddress",           // Your wallet
  to: "0xRecipientAddress",        // API provider's wallet
  value: "10000",                  // Amount in USDC units (0.01 USDC)
  validAfter: "1234567890",        // Unix timestamp (now)
  validBefore: "1234571490",       // Unix timestamp (now + 1 hour)
  nonce: "0xrandom32bytes",        // Unique nonce
  signature: "0x..."               // Your EIP-712 signature
}
```

The server verifies the signature and executes the transfer on-chain.

## Supported Blockchains

| Chain | Identifier | Example Address |
|-------|-----------|-----------------|
| Ethereum/EVM | `evm` | `0x3fdee07b0756651152bf11c8d170d72d7ebbec49` |
| Bitcoin | `bitcoin` | `1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa` |
| Solana | `solana` | `7EqQdEUfQqo2gRKmJhZdCKQYqBbJmhPKqWHyLpHKcKHJ` |
| Tron | `tron` | `TYASr5UV6HEcXatwdFQfmLVUqQQQMUxHLS` |

## Troubleshooting

### "EVM_PRIVATE_KEY environment variable required"

```bash
# Set your private key
export EVM_PRIVATE_KEY=0xyour_64_character_hex_key

# Verify it's set
echo $EVM_PRIVATE_KEY
```

### "Failed to create payment"

- Ensure your wallet has USDC on the correct network
- Verify you have ETH for gas fees (even though no gas is paid upfront)
- Check your private key is valid (64 hex characters)

### "Connection refused" or "Network error"

- Verify the API URL is correct
- Check your internet connection
- For local development, ensure the server is running

### "Insufficient USDC balance"

- Get testnet USDC from faucets
- Check balance: https://sepolia.basescan.org/address/YOUR_ADDRESS
- Ensure you're on the correct network (base-sepolia vs base)

## Security

⚠️ **IMPORTANT SECURITY WARNINGS:**

1. **Never commit private keys** to version control
2. **Use testnet for development** (base-sepolia)
3. **Use separate wallets** for testing vs production
4. **Only fund wallets** with amounts you're willing to lose
5. **Rotate keys immediately** if exposed
6. **Use environment variables** for all secrets

### Best Practices

- ✅ Use `.env` files (add to `.gitignore`)
- ✅ Use different keys for dev/prod
- ✅ Use hardware wallets for production
- ✅ Implement key management (AWS KMS, HashiCorp Vault, etc.)
- ✅ Monitor wallet balances and transactions
- ✅ Set up alerts for unusual activity

## Pricing

Typical costs (varies by configuration):
- **Address screening**: ~$0.01 USDC per request
- **Batch screening**: Priced per address
- **Custom configs**: May have different pricing

Check the latest pricing at: https://cipherowl.ai/pricing

## Integration

### Install as Dependency

If you publish this as a package:

```bash
npm install @cipherowl/x402-screening-client
# or
bun add @cipherowl/x402-screening-client
```

Then use in your code:

```typescript
import { X402Client } from "@cipherowl/x402-screening-client";

const client = new X402Client({
  evmPrivateKey: process.env.EVM_PRIVATE_KEY as `0x${string}`,
});

const result = await client.request(
  `https://x402.cipherowl.ai/api-402/screen/v1/chains/evm/addresses/${address}`
);
```

### Copy Into Your Project

Alternatively, copy `client.ts` into your project:

```
your-project/
├── src/
│   └── utils/
│       └── x402-client.ts  # Copy client.ts here
└── package.json
```

## Development

### Project Structure

```
standalone-client/
├── client.ts           # X402Client implementation
├── index.ts            # Example usage
├── package.json        # Dependencies and scripts
├── .env.example        # Environment template
├── README.md           # This file
└── LICENSE             # MIT License
```

### Dependencies

- **viem**: Ethereum client library (for signing and RPC)
- Minimal dependencies for maximum compatibility

### Testing

```bash
# Set test environment
export EVM_PRIVATE_KEY=0x...
export NETWORK=base-sepolia
export API_URL=https://x402.cipherowl.ai

# Run example
bun run example
```

## Resources

- **x402 Protocol**: https://x402.gitbook.io/x402
- **CipherOwl API**: https://readme.cipherowl.ai/
- **EIP-3009**: https://eips.ethereum.org/EIPS/eip-3009
- **Base Network**: https://docs.base.org/
- **Viem Docs**: https://viem.sh/

## Support

For questions or issues:
- **CipherOwl Support**: support@cipherowl.ai
- **GitHub Issues**: https://github.com/cipherowl/x402-screening-client-example/issues
- **Documentation**: https://readme.cipherowl.ai/

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Changelog

### v0.1.0 (2025-11-01)
- Initial release
- Basic x402 client implementation
- Support for EVM, Bitcoin, Solana, Tron
- Example usage and documentation
