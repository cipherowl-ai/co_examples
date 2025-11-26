/**
 * CipherOwl x402 Screening Client - Example
 *
 * This example demonstrates using the official x402-fetch package
 * to interact with x402-protected APIs.
 *
 * Quick Start:
 *   1. export EVM_PRIVATE_KEY=0x...
 *   2. bun install
 *   3. bun run example
 */

import { X402Client } from "./client";
import type { Network } from "x402/types";

// Configuration
const CONFIG = {
  apiUrl: process.env.API_URL || "https://api.cipherowl.ai",
  privateKey: process.env.EVM_PRIVATE_KEY,
  // Production uses Base mainnet for payments
  network: (process.env.NETWORK || "base") as Network,
  // Production screening costs $0.50 USDC
  maxPayment: BigInt(process.env.MAX_PAYMENT || "1000000"), // 1.00 USDC default max

  // Example address to screen (this one is free for testing)
  testAddress: "0x3fdee07b0756651152bf11c8d170d72d7ebbec49",
  testChain: "evm" as const,
  screeningConfig: "co-high_risk_ext_hops_2",
};

async function main() {
  console.log("CipherOwl x402 Screening Client\n");

  // Validate environment
  if (!CONFIG.privateKey) {
    console.error("Error: EVM_PRIVATE_KEY environment variable required");
    console.error("   Example: export EVM_PRIVATE_KEY=0x...");
    process.exit(1);
  }

  // Initialize client
  console.log("Initializing X402Client...");
  const client = await X402Client.create({
    evmPrivateKey: CONFIG.privateKey,
    network: CONFIG.network,
    maxPayment: CONFIG.maxPayment,
    logger: console,
  });

  console.log(`Client ready`);
  console.log(`   Wallet:  ${client.getAddress()}`);
  console.log(`   Network: ${CONFIG.network}`);
  console.log(`   API:     ${CONFIG.apiUrl}\n`);

  // Screen an address
  console.log("=".repeat(60));
  console.log("Screening Address");
  console.log("=".repeat(60));
  console.log(`   Chain:   ${CONFIG.testChain}`);
  console.log(`   Address: ${CONFIG.testAddress}`);
  console.log(`   Config:  ${CONFIG.screeningConfig}\n`);

  try {
    const startTime = Date.now();
    const result = await client.screenAddress(
      CONFIG.apiUrl,
      CONFIG.testChain,
      CONFIG.testAddress,
      CONFIG.screeningConfig
    );
    const duration = Date.now() - startTime;

    console.log(`Request completed in ${duration}ms\n`);

    if (result.status === 200) {
      console.log("Screening Results:");
      console.log("-".repeat(40));
      console.log(`   Chain:       ${result.data.chain}`);
      console.log(`   Address:     ${result.data.address}`);
      console.log(`   Risk Found:  ${result.data.foundRisk ? "YES" : "NO"}`);
      if (result.data.riskScore !== undefined) {
        console.log(`   Risk Score:  ${result.data.riskScore}`);
      }
      console.log("-".repeat(40));
    } else {
      console.error(`Unexpected status: ${result.status}`);
      console.error("Response:", result.data);
      process.exit(1);
    }
  } catch (error) {
    console.error("\nScreening failed!");
    console.error("-".repeat(40));

    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);

      console.log("\nTroubleshooting:");
      if (error.message.includes("Payment amount exceeds")) {
        console.log("- The payment required exceeds the configured maximum");
        console.log("- Increase maxPayment option if you accept higher costs");
      } else if (error.message.includes("fetch")) {
        console.log("- Verify API_URL is accessible");
        console.log(`- Current API: ${CONFIG.apiUrl}`);
      }

      console.log("\nGeneral checks:");
      console.log("- Verify EVM_PRIVATE_KEY is set correctly");
      console.log("- Ensure wallet has USDC on the correct network");
      console.log("- Check API endpoint is accessible");
    }

    process.exit(1);
  }
}

// Run if executed directly
main().catch(console.error);

export { X402Client } from "./client";
export { main };
