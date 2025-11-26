# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a collection of CipherOwl examples, currently containing the `402_standalone-client` - a TypeScript client demonstrating the x402 protocol for HTTP micropayments using blockchain addresses.

## Project: 402_standalone-client

### Purpose
A standalone client for CipherOwl's x402-protected blockchain address screening API. The x402 protocol enables pay-per-use APIs using cryptocurrency (USDC) without requiring subscriptions or API keys.

### Development Commands

**Setup:**
```bash
cd 402_standalone-client
bun install
# or npm install
```

**Environment:**
```bash
cp .env.example .env
# Edit .env and set EVM_PRIVATE_KEY
```

**Run Example:**
```bash
bun run example
# or npm run example
```

**Additional Examples:**
```bash
bun run example:batch          # Batch screening (if examples/ exists)
bun run example:multi-config   # Multi-config screening (if examples/ exists)
```

### Core Architecture

#### X402 Payment Flow
The client implements a two-step HTTP micropayment protocol:

1. **Initial Request** → Server responds `402 Payment Required` with payment details
2. **Payment Creation** → Client creates EIP-3009 authorization (gasless USDC transfer)
3. **Retry with Payment** → Client retries request with `X-PAYMENT` header
4. **Server Verifies** → Server validates signature and responds with data

#### Key Components

**client.ts** - Core X402Client implementation
- `X402Client`: Main client class that handles the payment flow
- Constructor defaults `facilitatorUrl` to `https://x402.cipherowl.ai` (users don't need to configure)
- `createPayment()`: Creates EIP-3009 TransferWithAuthorization signatures
- `request()`: Public method that automatically handles 402 responses
- Uses viem for EVM interactions (signing, RPC)

**index.ts** - Example usage
- Demonstrates basic address screening workflow
- Shows error handling and environment setup

#### Payment Authorization (EIP-3009)
The client creates gasless USDC transfers using EIP-712 typed signatures:
- No upfront gas required from user
- Server executes the transfer on-chain after verification
- Signatures are time-bound (validAfter/validBefore)
- Uses cryptographic nonces to prevent replay attacks

### Technical Details

**Dependencies:**
- `viem ^2.38.5`: Ethereum client library for signing and RPC
- TypeScript module system (`type: "module"`)

**Networks:**
- `base-sepolia`: Testnet for development
- `base`: Mainnet for production

**Blockchain Support:**
- EVM/Ethereum
- Bitcoin
- Solana
- Tron

### Security Considerations

**Private Key Management:**
- Never commit `.env` files (already in `.gitignore`)
- Use separate wallets for development vs production
- Private keys must be 32-byte hex strings (with or without `0x` prefix)
- Client normalizes and validates private key format

**Payment Security:**
- EIP-3009 signatures are time-bound (1 hour validity)
- Unique nonces prevent replay attacks
- Signatures are domain-separated by contract address and chain ID

### Environment Variables

**Required:**
- `EVM_PRIVATE_KEY`: Wallet private key (must have USDC on settlement network)

**Optional:**
- `NETWORK`: "base" or "base-sepolia" (default: base-sepolia for examples)
- `RPC_URL`: Custom RPC endpoint (optional, uses public RPCs otherwise)

**Note:** The `facilitatorUrl` is hardcoded to `https://x402.cipherowl.ai` and users should not need to configure it. The example code's `API_URL` environment variable is only used for building request URLs, not for client configuration.

### API Structure

**Screening Endpoint:**
```
GET /api-402/screen/v1/chains/:chain/addresses/:address?config=:config
```

**Response Format:**
```json
{
  "chain": "evm",
  "address": "0x...",
  "foundRisk": false,
  "riskScore": 0,
  "config": "co-high_risk_ext_hops_2"
}
```

### Implementation Notes

**When modifying the client:**
- The `facilitatorUrl` defaults to CipherOwl's production API - users should not need to configure it
- Payment creation is the most complex part - it requires correct EIP-712 domain, types, and message formatting
- The nonce generation combines timestamp (8 bytes) + random bytes (24 bytes) for uniqueness
- Contract name and version are fetched from the USDC contract for EIP-712 domain
- Base64 encoding handles both Node.js Buffer and browser btoa environments

**Error Handling:**
- Client validates all constructor inputs (private key format, URL validity)
- Payment failures should suggest checking USDC balance and network
- Network errors should suggest checking API URL accessibility
