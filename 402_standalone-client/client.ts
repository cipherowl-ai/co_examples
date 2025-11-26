/**
 * X402Client - Client for x402-protected APIs
 *
 * Uses the official x402-fetch package to handle x402 payment protocol.
 * Wraps fetch to automatically handle 402 Payment Required responses.
 *
 * @see https://x402.gitbook.io/x402
 */

import { wrapFetchWithPayment, createSigner } from "x402-fetch";
import type { Network } from "x402/types";

export interface X402ClientOptions {
  /** Your EVM wallet private key (must have USDC on settlement network) */
  evmPrivateKey: `0x${string}` | string;
  /** Settlement network. Defaults to base-sepolia (testnet) for safety */
  network?: Network;
  /** Maximum payment amount in USDC base units (6 decimals). Defaults to 0.10 USDC */
  maxPayment?: bigint;
  /** Optional logger for debugging */
  logger?: Pick<Console, "debug" | "error">;
}

export interface ScreeningResult {
  chain: string;
  address: string;
  foundRisk: boolean;
  riskScore?: number;
  riskDetails?: unknown;
}

export interface X402RequestResult<T> {
  data: T;
  status: number;
  headers: Headers;
}

export class X402Client {
  private fetchWithPayment: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
  private network: Network;
  private logger?: Pick<Console, "debug" | "error">;
  private signerAddress?: string;

  private constructor(
    fetchWithPayment: (input: RequestInfo, init?: RequestInit) => Promise<Response>,
    network: Network,
    signerAddress?: string,
    logger?: Pick<Console, "debug" | "error">
  ) {
    this.fetchWithPayment = fetchWithPayment;
    this.network = network;
    this.signerAddress = signerAddress;
    this.logger = logger;
  }

  /**
   * Create a new X402Client instance
   *
   * @param options - Client configuration options
   * @returns Promise resolving to configured X402Client
   */
  static async create(options: X402ClientOptions): Promise<X402Client> {
    const network = options.network || "base-sepolia";
    const maxPayment = options.maxPayment ?? BigInt(0.1 * 10 ** 6); // 0.10 USDC default

    // Normalize private key
    const privateKey = options.evmPrivateKey.startsWith("0x")
      ? options.evmPrivateKey
      : `0x${options.evmPrivateKey}`;

    // Create signer using x402's createSigner
    const signer = await createSigner(network, privateKey as `0x${string}`);

    // Get signer address for logging
    const signerAddress = (signer as { account?: { address?: string } }).account?.address;

    // Wrap fetch with x402 payment handling
    const fetchWithPayment = wrapFetchWithPayment(
      globalThis.fetch,
      signer,
      maxPayment
    );

    return new X402Client(fetchWithPayment, network, signerAddress, options.logger);
  }

  /** Get the wallet address for this client */
  getAddress(): string | undefined {
    return this.signerAddress;
  }

  /** Get the current network configuration */
  getNetwork(): Network {
    return this.network;
  }

  /**
   * Make a request with automatic x402 payment handling
   *
   * @param url - API endpoint URL
   * @param options - Standard fetch request options
   * @returns Response with data, status, and headers
   */
  async request<T = unknown>(
    url: string,
    options: RequestInit = {}
  ): Promise<X402RequestResult<T>> {
    this.logger?.debug(`Making request to ${url}`);

    const response = await this.fetchWithPayment(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    const data = await response.json() as T;

    return {
      data,
      status: response.status,
      headers: response.headers,
    };
  }

  /**
   * Screen a blockchain address for risk
   *
   * @param apiBase - Base URL of the screening API
   * @param chain - Blockchain identifier (evm, bitcoin, solana, tron)
   * @param address - Address to screen
   * @param config - Optional screening configuration
   * @returns Screening result
   */
  async screenAddress(
    apiBase: string,
    chain: string,
    address: string,
    config?: string
  ): Promise<X402RequestResult<ScreeningResult>> {
    const url = new URL(`${apiBase}/api-402/screen/v1/chains/${chain}/addresses/${address}`);
    if (config) {
      url.searchParams.set("config", config);
    }

    return this.request<ScreeningResult>(url.toString());
  }
}
