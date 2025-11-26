/**
 * X402Client - Client for x402-protected APIs
 *
 * Automatically handles the x402 payment flow:
 * 1. Receives 402 Payment Required response
 * 2. Creates EIP-3009 payment authorization
 * 3. Signs with your private key
 * 4. Retries request with X-PAYMENT header
 *
 * @see https://x402.gitbook.io/x402
 */

import { base, baseSepolia } from "viem/chains";
import { privateKeyToAccount, privateKeyToAddress } from "viem/accounts";
import { createPublicClient, createWalletClient, http } from "viem";

type FetchLike = typeof fetch;
type Logger = Pick<Console, "debug" | "error">;

export interface X402RequestResult<T> {
  data: T;
  status: number;
  headers: Headers;
}

export interface X402ClientOptions {
  facilitatorUrl?: string;           // Optional: defaults to https://x402.cipherowl.ai
  evmPrivateKey: `0x${string}` | string;
  network?: typeof base | typeof baseSepolia;
  rpcUrl?: string;
  fetch?: FetchLike;
  logger?: Logger;
}

export interface X402PaymentDetails {
  accepts: Array<{
    scheme: string;
    network: string;
    maxAmountRequired: string;
    resource: string;
    description?: string;
    mimeType?: string;
    payTo: string;
    maxTimeoutSeconds?: number;
    asset: string;
  }>;
  x402Version?: number;
}

interface ExactEvmAuthorization {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: `0x${string}`;
}

interface ExactEvmPaymentPayload {
  x402Version: number;
  scheme: string;
  network: string;
  payload: {
    signature: `0x${string}`;
    authorization: ExactEvmAuthorization;
  };
}

export class X402Client {
  private facilitatorUrl: string;
  private accountAddress: string;
  private walletClient: ReturnType<typeof createWalletClient>;
  private publicClient: ReturnType<typeof createPublicClient>;
  private network: typeof base | typeof baseSepolia;
  private account: ReturnType<typeof privateKeyToAccount>;
  private fetchFn?: FetchLike;
  private logger?: Logger;

  constructor(options: X402ClientOptions) {
    this.facilitatorUrl = this.normalizeFacilitatorUrl(
      options.facilitatorUrl || "https://x402.cipherowl.ai"
    );
    this.network = options.network || base;

    const privateKey = this.normalizePrivateKey(options.evmPrivateKey);
    this.accountAddress = privateKeyToAddress(privateKey as `0x${string}`);
    this.account = privateKeyToAccount(privateKey as `0x${string}`);

    const rpcUrl = options.rpcUrl ?? process.env.RPC_URL;
    this.walletClient = createWalletClient({
      account: this.account,
      chain: this.network,
      transport: rpcUrl ? http(rpcUrl) : http(),
    });

    this.publicClient = createPublicClient({
      chain: this.network,
      transport: rpcUrl ? http(rpcUrl) : http(),
    });

    this.fetchFn = options.fetch;
    this.logger = options.logger;
  }

  getAddress(): string {
    return this.accountAddress;
  }

  async request<T = unknown>(
    url: string,
    options: RequestInit = {}
  ): Promise<X402RequestResult<T>> {
    const fetchImpl = this.fetchFn ?? this.resolveFetch();
    const initialResponse = await fetchImpl(url, options);
    const initialData = await this.parseResponse(initialResponse);

    if (initialResponse.status !== 402) {
      return {
        data: initialData as T,
        status: initialResponse.status,
        headers: initialResponse.headers,
      };
    }

    const paymentDetails = initialData as X402PaymentDetails;
    if (!paymentDetails.accepts || paymentDetails.accepts.length === 0) {
      throw new Error("No payment options available in 402 response");
    }

    const paymentOption = paymentDetails.accepts[0];
    const paymentPayload = await this.createPayment({
      amount: BigInt(paymentOption.maxAmountRequired),
      recipient: paymentOption.payTo as `0x${string}`,
      reference: paymentOption.resource || url,
      asset: paymentOption.asset as `0x${string}`,
      scheme: paymentOption.scheme || "exact",
      network: paymentOption.network,
    });

    this.logDebug("Sending payment payload to middleware");

    const base64Payment = this.encodePaymentPayload(paymentPayload);
    const paidResponse = await fetchImpl(url, {
      ...options,
      headers: {
        ...options.headers,
        "X-PAYMENT": base64Payment,
      },
    });

    const paidData = await this.parseResponse(paidResponse);
    if (paidResponse.status !== 200) {
      throw new Error(
        `Payment accepted but request failed: ${paidResponse.status}. ${JSON.stringify(paidData)}`
      );
    }

    return {
      data: paidData as T,
      status: paidResponse.status,
      headers: paidResponse.headers,
    };
  }

  private async createPayment(params: {
    amount: bigint;
    recipient: `0x${string}`;
    reference: string;
    asset: `0x${string}`;
    scheme: string;
    network: string;
  }): Promise<ExactEvmPaymentPayload> {
    try {
      const usdcAbi = [
        {
          name: 'name',
          type: 'function',
          stateMutability: 'view',
          inputs: [],
          outputs: [{ name: '', type: 'string' }],
        },
        {
          name: 'version',
          type: 'function',
          stateMutability: 'view',
          inputs: [],
          outputs: [{ name: '', type: 'string' }],
        },
      ] as const;

      const [contractName, contractVersion] = await Promise.all([
        this.publicClient.readContract({
          address: params.asset,
          abi: usdcAbi,
          functionName: 'name',
        }).catch(() => 'USD Coin'),
        this.publicClient.readContract({
          address: params.asset,
          abi: usdcAbi,
          functionName: 'version',
        }).catch(() => '2'),
      ]);

      const now = BigInt(Math.floor(Date.now() / 1000));
      const validAfter = now;
      const validBefore = now + BigInt(3600);

      const timestamp = Math.floor(Date.now() / 1000);
      const timestampHex = timestamp.toString(16).padStart(16, '0');
      const randomBytes = Array.from({ length: 24 }, () =>
        Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
      ).join('');
      const nonceBytes = `0x${timestampHex}${randomBytes}` as `0x${string}`;

      const domain = {
        name: contractName || 'USD Coin',
        version: contractVersion || '2',
        chainId: this.network.id,
        verifyingContract: params.asset,
      };

      const types = {
        TransferWithAuthorization: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'validAfter', type: 'uint256' },
          { name: 'validBefore', type: 'uint256' },
          { name: 'nonce', type: 'bytes32' },
        ],
      };

      const message = {
        from: this.accountAddress,
        to: params.recipient,
        value: params.amount,
        validAfter,
        validBefore,
        nonce: nonceBytes,
      };

      const signature = await this.walletClient.signTypedData({
        domain,
        types,
        primaryType: 'TransferWithAuthorization',
        message,
      });

      const authorization: ExactEvmAuthorization = {
        from: this.accountAddress,
        to: params.recipient,
        value: params.amount.toString(),
        validAfter: validAfter.toString(),
        validBefore: validBefore.toString(),
        nonce: nonceBytes,
      };

      this.logDebug(
        `Created payment authorization from ${this.accountAddress} to ${params.recipient} for ${params.amount.toString()} units`
      );

      return {
        x402Version: 1,
        scheme: params.scheme,
        network: params.network,
        payload: {
          signature: signature as `0x${string}`,
          authorization,
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to create payment: ${error.message}`);
      }
      throw new Error("Failed to create payment: Unknown error");
    }
  }

  private async parseResponse(response: Response): Promise<unknown> {
    const contentType = response.headers.get("content-type") || "";
    const text = await this.safeReadText(response);

    if (!text) {
      return {};
    }

    try {
      return JSON.parse(text);
    } catch (error) {
      const isJsonContentType =
        contentType.includes("application/json") || contentType.includes("+json");

      if (isJsonContentType) {
        this.logDebug(`Failed to parse JSON response: ${(error as Error).message}`);
      }

      return { error: text || "Invalid response" };
    }
  }

  private encodePaymentPayload(payload: ExactEvmPaymentPayload): string {
    const json = JSON.stringify(payload);

    if (typeof Buffer !== "undefined") {
      return Buffer.from(json, "utf8").toString("base64");
    }

    const encoder = new TextEncoder();
    const bytes = encoder.encode(json);
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });

    if (typeof btoa === "function") {
      return btoa(binary);
    }

    throw new Error("No base64 encoder available in current environment");
  }

  private normalizePrivateKey(key: `0x${string}` | string): `0x${string}` {
    const prefixed = key.startsWith("0x") ? key : `0x${key}`;
    if (!/^0x[0-9a-fA-F]{64}$/.test(prefixed)) {
      throw new Error("evmPrivateKey must be a 32-byte hex string");
    }
    return prefixed as `0x${string}`;
  }

  private normalizeFacilitatorUrl(url: string): string {
    try {
      const parsed = new URL(url);
      if (!parsed.protocol.startsWith("http")) {
        throw new Error("facilitatorUrl must use http or https");
      }
      return parsed.toString().replace(/\/$/, "");
    } catch (error) {
      throw new Error(
        `facilitatorUrl is invalid: ${error instanceof Error ? error.message : "unknown error"}`
      );
    }
  }

  private logDebug(message: string): void {
    this.logger?.debug(message);
  }

  private resolveFetch(): FetchLike {
    const globalFetch = globalThis.fetch;
    if (!globalFetch) {
      throw new Error("Fetch implementation not available; provide one via options.fetch");
    }
    return globalFetch.bind(globalThis);
  }

  private async safeReadText(response: Response): Promise<string> {
    try {
      if (typeof response.text === "function") {
        return await response.text();
      }

      const mockResponse = response as unknown as { json?: () => Promise<unknown> };
      if (typeof mockResponse.json === "function") {
        const data = await mockResponse.json();
        return typeof data === "string" ? data : JSON.stringify(data);
      }
    } catch (error) {
      this.logDebug(`Failed to read response body: ${(error as Error).message}`);
    }

    return "";
  }
}
