/**
 * CipherOwl x402 Screening Client - Example
 *
 * This example demonstrates how to screen blockchain addresses using
 * CipherOwl's API with automatic x402 payment handling.
 *
 * Quick Start:
 *   1. export EVM_PRIVATE_KEY=0x...
 *   2. bun install
 *   3. bun run example
 */

import { X402Client } from "./client";
import { base, baseSepolia } from "viem/chains";

// Configuration
const CONFIG = {
  apiUrl: process.env.API_URL || "https://x402.cipherowl.ai",
  privateKey: process.env.EVM_PRIVATE_KEY,
  network: (process.env.NETWORK || "base-sepolia") as "base" | "base-sepolia",
  rpcUrl: process.env.RPC_URL,

  // Example address to screen
  testAddress: "0x3fdee07b0756651152bf11c8d170d72d7ebbec49",
  testChain: "evm" as const,
  screeningConfig: "co-high_risk_ext_hops_2",
};

function formatUSDC(amount: string): string {
  return `${(Number(amount) / 1_000_000).toFixed(6)} USDC`;
}

async function main() {
  console.log("🦉 CipherOwl x402 Screening Client\n");

  // Validate environment
  if (!CONFIG.privateKey) {
    console.error("❌ Error: EVM_PRIVATE_KEY environment variable required");
    console.error("   Example: export EVM_PRIVATE_KEY=0x...");
    process.exit(1);
  }

  const privateKey = CONFIG.privateKey.startsWith('0x')
    ? CONFIG.privateKey
    : `0x${CONFIG.privateKey}`;

  const network = CONFIG.network === "base" ? base : baseSepolia;

  // Initialize client
  console.log("📦 Initializing X402Client");
  const client = new X402Client({
    evmPrivateKey: privateKey as `0x${string}`,
    network,
    rpcUrl: CONFIG.rpcUrl,
    logger: console,
  });

  console.log(`✅ Client ready`);
  console.log(`   Wallet:  ${client.getAddress()}`);
  console.log(`   Network: ${CONFIG.network}`);
  console.log(`   API:     ${CONFIG.apiUrl}\n`);

  // Build endpoint
  const endpoint = `${CONFIG.apiUrl}/api-402/screen/v1/chains/${CONFIG.testChain}/addresses/${CONFIG.testAddress}?config=${CONFIG.screeningConfig}`;

  console.log("📤 Screening address...");
  console.log(`   Chain:   ${CONFIG.testChain}`);
  console.log(`   Address: ${CONFIG.testAddress}`);
  console.log(`   Config:  ${CONFIG.screeningConfig}\n`);

  try {
    const startTime = Date.now();
    const result = await client.request(endpoint);
    const duration = Date.now() - startTime;

    if (result.status === 200) {
      console.log(`✅ Request completed in ${duration}ms\n`);

      const data = result.data as any;

      console.log("📊 Screening Results:");
      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      console.log(`Chain:       ${data.chain}`);
      console.log(`Address:     ${data.address}`);
      console.log(`Risk Found:  ${data.foundRisk ? '⚠️  YES' : '✅ NO'}`);

      if (data.riskScore !== undefined) {
        console.log(`Risk Score:  ${data.riskScore}`);
      }

      if (data.riskCategories && data.riskCategories.length > 0) {
        console.log(`\nRisk Categories:`);
        data.riskCategories.forEach((category: string) => {
          console.log(`  • ${category}`);
        });
      }

      console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
      console.log("🎉 Screening complete!");
    } else {
      console.error(`❌ Unexpected status: ${result.status}`);
      console.error("Response:", result.data);
      process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ Screening failed!");
    console.error("─────────────────────────────────────");

    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);

      console.log("\n💡 Troubleshooting:");
      if (error.message.includes("Failed to create payment")) {
        console.log("• Check your wallet has USDC on the correct network");
        console.log(`• Current network: ${CONFIG.network}`);
      } else if (error.message.includes("fetch")) {
        console.log("• Verify API_URL is accessible");
        console.log(`• Current API: ${CONFIG.apiUrl}`);
      }

      console.log("\nGeneral checks:");
      console.log("• Verify EVM_PRIVATE_KEY is set correctly");
      console.log("• Ensure wallet has USDC on the correct network");
      console.log("• Check API endpoint is accessible");
    }

    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { X402Client } from "./client";
export { main };
