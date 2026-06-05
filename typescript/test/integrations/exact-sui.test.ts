import type {
  FacilitatorClient,
  HTTPAdapter,
  HTTPResponseInstructions,
} from "@x402/core/server";
import type {
  Network,
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
  SupportedResponse,
  VerifyResponse,
} from "@x402/core/types";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { fromBase64 } from "@mysten/sui/utils";
import { x402Client, x402HTTPClient } from "@x402/core/client";
import { x402Facilitator } from "@x402/core/facilitator";
import { x402HTTPResourceServer, x402ResourceServer } from "@x402/core/server";
import { beforeEach, describe, expect, it } from "vitest";

import type { ClientSuiSigner, FacilitatorSuiSigner } from "../../src/signer";
import type { SuiAddress } from "../../src/types";
import {
  DEFAULT_GAS_BUDGET,
  SUI_TESTNET_CAIP2,
  SUI_TESTNET_GRPC_URL,
  USDC_TESTNET_COIN_TYPE,
} from "../../src/constants";
import { ExactSuiScheme as ExactSuiClient } from "../../src/exact/client/scheme";
import { ExactSuiScheme as ExactSuiFacilitator } from "../../src/exact/facilitator/scheme";
import { ExactSuiScheme as ExactSuiServer } from "../../src/exact/server/scheme";

const CLIENT_PRIVATE_KEY = process.env.CLIENT_PRIVATE_KEY;
const FACILITATOR_PRIVATE_KEY = process.env.FACILITATOR_PRIVATE_KEY;
const RESOURCE_SERVER_ADDRESS = process.env.RESOURCE_SERVER_ADDRESS;

if (
  !CLIENT_PRIVATE_KEY ||
  !FACILITATOR_PRIVATE_KEY ||
  !RESOURCE_SERVER_ADDRESS
) {
  throw new Error(
    "CLIENT_PRIVATE_KEY, FACILITATOR_PRIVATE_KEY and RESOURCE_SERVER_ADDRESS environment variables must be set for integration tests"
  );
}

/**
 * Build a ClientSuiSigner from an Ed25519Keypair.
 */
function toClientSuiSigner(keypair: Ed25519Keypair): ClientSuiSigner {
  return {
    address: keypair.toSuiAddress() as SuiAddress,
    signTransaction: async (base64Bytes: string): Promise<string> => {
      const { signature } = await keypair.signTransaction(
        fromBase64(base64Bytes)
      );
      return signature;
    },
  };
}

/**
 * Build a FacilitatorSuiSigner from an Ed25519Keypair.
 */
function toFacilitatorSuiSignerFromKeypair(
  keypair: Ed25519Keypair
): FacilitatorSuiSigner {
  const address = keypair.toSuiAddress() as SuiAddress;
  return {
    getAddresses: () => [address],
    getGasBudget: () => DEFAULT_GAS_BUDGET,
    signTransaction: async (base64Bytes: string): Promise<string> => {
      const { signature } = await keypair.signTransaction(
        fromBase64(base64Bytes)
      );
      return signature;
    },
  };
}

/**
 * Sui Facilitator Client wrapper
 * Wraps the x402Facilitator for use with x402ResourceServer
 */
class SuiFacilitatorClient implements FacilitatorClient {
  readonly scheme = "exact";
  readonly network = SUI_TESTNET_CAIP2;
  readonly x402Version = 2;

  constructor(private readonly facilitator: x402Facilitator) {}

  verify(
    paymentPayload: PaymentPayload,
    paymentRequirements: PaymentRequirements
  ): Promise<VerifyResponse> {
    return this.facilitator.verify(paymentPayload, paymentRequirements);
  }

  settle(
    paymentPayload: PaymentPayload,
    paymentRequirements: PaymentRequirements
  ): Promise<SettleResponse> {
    return this.facilitator.settle(paymentPayload, paymentRequirements);
  }

  async getSupported(): Promise<SupportedResponse> {
    return this.facilitator.getSupported() as SupportedResponse;
  }
}

/**
 * Build Sui payment requirements for testing.
 */
function buildSuiPaymentRequirements(
  payTo: string,
  amount: string,
  network: Network = SUI_TESTNET_CAIP2,
  extra: Record<string, unknown> = {}
): PaymentRequirements {
  return {
    scheme: "exact",
    network,
    asset: USDC_TESTNET_COIN_TYPE,
    amount,
    payTo,
    maxTimeoutSeconds: 3600,
    extra,
  };
}

describe("Sui Integration Tests", () => {
  describe("x402Client / x402ResourceServer / x402Facilitator - Sui Flow", () => {
    let client: x402Client;
    let server: x402ResourceServer;
    let clientAddress: string;
    let gasOwner: string;

    beforeEach(async () => {
      const clientKeypair = Ed25519Keypair.fromSecretKey(
        CLIENT_PRIVATE_KEY as string
      );
      clientAddress = clientKeypair.toSuiAddress();
      const clientSigner = toClientSuiSigner(clientKeypair);

      const suiClient = new ExactSuiClient(clientSigner);
      client = new x402Client().register(SUI_TESTNET_CAIP2, suiClient);

      const facilitatorKeypair = Ed25519Keypair.fromSecretKey(
        FACILITATOR_PRIVATE_KEY as string
      );
      const facilitatorSigner =
        toFacilitatorSuiSignerFromKeypair(facilitatorKeypair);
      gasOwner = facilitatorKeypair.toSuiAddress();

      const suiFacilitator = new ExactSuiFacilitator(facilitatorSigner);
      const facilitator = new x402Facilitator().register(
        SUI_TESTNET_CAIP2,
        suiFacilitator
      );

      const facilitatorClient = new SuiFacilitatorClient(facilitator);
      server = new x402ResourceServer(facilitatorClient);
      server.register(SUI_TESTNET_CAIP2, new ExactSuiServer());
      await server.initialize();
    });

    it("server should successfully verify and settle a Sui payment from a client", async () => {
      const accepts = [
        buildSuiPaymentRequirements(
          RESOURCE_SERVER_ADDRESS as string,
          "1000",
          SUI_TESTNET_CAIP2,
          { gasOwner }
        ),
      ];
      const resource = {
        url: "https://company.co",
        description: "Company Co. resource",
        mimeType: "application/json",
      };

      const paymentRequired = await server.createPaymentRequiredResponse(
        accepts,
        resource
      );

      const paymentPayload = await client.createPaymentPayload(paymentRequired);

      expect(paymentPayload).toBeDefined();
      expect(paymentPayload.x402Version).toBe(2);
      expect(paymentPayload.accepted.scheme).toBe("exact");
      expect(paymentPayload.accepted.network).toBe(SUI_TESTNET_CAIP2);

      const suiPayload = paymentPayload.payload as {
        transaction: string;
        signature: string;
      };
      expect(suiPayload.transaction).toBeDefined();
      expect(suiPayload.signature).toBeDefined();
      expect(typeof suiPayload.transaction).toBe("string");
      expect(suiPayload.transaction.length).toBeGreaterThan(0);

      const accepted = server.findMatchingRequirements(accepts, paymentPayload);
      expect(accepted).toBeDefined();

      const verifyResponse = await server.verifyPayment(
        paymentPayload,
        accepted as PaymentRequirements
      );
      expect(verifyResponse.isValid).toBe(true);
      expect(verifyResponse.payer).toBe(clientAddress);

      const settleResponse = await server.settlePayment(
        paymentPayload,
        accepted as PaymentRequirements
      );
      expect(settleResponse.success).toBe(true);
      expect(settleResponse.network).toBe(SUI_TESTNET_CAIP2);
      expect(settleResponse.transaction).toBeDefined();
      expect(settleResponse.payer).toBe(clientAddress);
    });
  });

  describe("x402HTTPClient / x402HTTPResourceServer / x402Facilitator - Sui Flow", () => {
    let client: x402HTTPClient;
    let httpServer: x402HTTPResourceServer;

    const routes = {
      "/api/protected": {
        accepts: {
          scheme: "exact",
          payTo: RESOURCE_SERVER_ADDRESS as string,
          price: "$0.001",
          network: SUI_TESTNET_CAIP2 as Network,
        },
        description: "Access to protected API",
        mimeType: "application/json",
      },
    };

    const mockAdapter: HTTPAdapter = {
      getHeader: () => undefined,
      getMethod: () => "GET",
      getPath: () => "/api/protected",
      getUrl: () => "https://example.com/api/protected",
      getAcceptHeader: () => "application/json",
      getUserAgent: () => "TestClient/1.0",
    };

    beforeEach(async () => {
      const facilitatorKeypair = Ed25519Keypair.fromSecretKey(
        FACILITATOR_PRIVATE_KEY as string
      );
      const facilitatorSigner =
        toFacilitatorSuiSignerFromKeypair(facilitatorKeypair);

      const suiFacilitator = new ExactSuiFacilitator(facilitatorSigner);
      const facilitator = new x402Facilitator().register(
        SUI_TESTNET_CAIP2,
        suiFacilitator
      );

      const facilitatorClient = new SuiFacilitatorClient(facilitator);

      const clientKeypair = Ed25519Keypair.fromSecretKey(
        CLIENT_PRIVATE_KEY as string
      );
      const clientSigner = toClientSuiSigner(clientKeypair);

      const suiClient = new ExactSuiClient(clientSigner);
      const paymentClient = new x402Client().register(
        SUI_TESTNET_CAIP2,
        suiClient
      );
      client = new x402HTTPClient(paymentClient) as x402HTTPClient;

      const ResourceServer = new x402ResourceServer(facilitatorClient);
      ResourceServer.register(SUI_TESTNET_CAIP2, new ExactSuiServer());
      await ResourceServer.initialize();

      httpServer = new x402HTTPResourceServer(ResourceServer, routes);
    });

    it("middleware should successfully verify and settle a Sui payment from an http client", async () => {
      const context = {
        adapter: mockAdapter,
        path: "/api/protected",
        method: "GET",
      };

      const httpProcessResult = await httpServer.processHTTPRequest(context);
      expect(httpProcessResult).toBeDefined();
      expect(httpProcessResult.type).toBe("payment-error");

      const initial402Response = (
        httpProcessResult as {
          type: "payment-error";
          response: HTTPResponseInstructions;
        }
      ).response;

      expect(initial402Response.status).toBe(402);
      expect(initial402Response.headers["PAYMENT-REQUIRED"]).toBeDefined();

      const paymentRequired = client.getPaymentRequiredResponse(
        (name: string) => initial402Response.headers[name],
        initial402Response.body
      );
      const paymentPayload = await client.createPaymentPayload(paymentRequired);

      expect(paymentPayload.accepted.scheme).toBe("exact");
      expect(paymentPayload.accepted.network).toBe(SUI_TESTNET_CAIP2);

      const requestHeaders =
        await client.encodePaymentSignatureHeader(paymentPayload);

      mockAdapter.getHeader = (name: string) => {
        if (name === "PAYMENT-SIGNATURE") {
          return requestHeaders["PAYMENT-SIGNATURE"];
        }
        return undefined;
      };

      const httpProcessResult2 = await httpServer.processHTTPRequest(context);

      expect(httpProcessResult2.type).toBe("payment-verified");
      const {
        paymentPayload: verifiedPaymentPayload,
        paymentRequirements: verifiedPaymentRequirements,
      } = httpProcessResult2 as {
        type: "payment-verified";
        paymentPayload: PaymentPayload;
        paymentRequirements: PaymentRequirements;
      };

      expect(verifiedPaymentPayload).toBeDefined();
      expect(verifiedPaymentRequirements).toBeDefined();

      const settlementResult = await httpServer.processSettlement(
        verifiedPaymentPayload,
        verifiedPaymentRequirements
      );

      expect(settlementResult).toBeDefined();
      expect(settlementResult.success).toBe(true);

      if (settlementResult.success) {
        expect(settlementResult.headers["PAYMENT-RESPONSE"]).toBeDefined();
      }
    });
  });

  describe("Price Parsing Integration", () => {
    let server: x402ResourceServer;
    let suiServer: ExactSuiServer;

    beforeEach(async () => {
      const facilitatorKeypair = Ed25519Keypair.fromSecretKey(
        FACILITATOR_PRIVATE_KEY as string
      );
      const facilitatorSigner =
        toFacilitatorSuiSignerFromKeypair(facilitatorKeypair);

      const facilitator = new x402Facilitator().register(
        SUI_TESTNET_CAIP2,
        new ExactSuiFacilitator(facilitatorSigner)
      );

      const facilitatorClient = new SuiFacilitatorClient(facilitator);
      server = new x402ResourceServer(facilitatorClient);

      suiServer = new ExactSuiServer();
      server.register(SUI_TESTNET_CAIP2, suiServer);
      await server.initialize();
    });

    it("should parse Money formats and build payment requirements", async () => {
      const testCases = [
        { input: "$1.00", expectedAmount: "1000000" },
        { input: "1.50", expectedAmount: "1500000" },
        { input: 2.5, expectedAmount: "2500000" },
      ];

      for (const testCase of testCases) {
        const requirements = await server.buildPaymentRequirements({
          scheme: "exact",
          payTo: RESOURCE_SERVER_ADDRESS as string,
          price: testCase.input,
          network: SUI_TESTNET_CAIP2 as Network,
        });

        expect(requirements).toHaveLength(1);
        expect(requirements[0].amount).toBe(testCase.expectedAmount);
        expect(requirements[0].asset).toBe(USDC_TESTNET_COIN_TYPE);
      }
    });

    it("should handle AssetAmount pass-through", async () => {
      const customAsset = {
        amount: "5000000",
        asset: "0xabc::usdt::USDT",
        extra: { foo: "bar" },
      };

      const requirements = await server.buildPaymentRequirements({
        scheme: "exact",
        payTo: RESOURCE_SERVER_ADDRESS as string,
        price: customAsset,
        network: SUI_TESTNET_CAIP2 as Network,
      });

      expect(requirements).toHaveLength(1);
      expect(requirements[0].amount).toBe("5000000");
      expect(requirements[0].asset).toBe("0xabc::usdt::USDT");
      expect(requirements[0].extra?.foo).toBe("bar");
    });

    it("should use registerMoneyParser for custom conversion", async () => {
      suiServer.registerMoneyParser(async (amount, _network) => {
        if (amount > 100) {
          return {
            amount: (amount * 1e9).toString(),
            asset: "0xcustom::token::LARGE",
            extra: { token: "LARGE", tier: "large" },
          };
        }
        return null;
      });

      const largeRequirements = await server.buildPaymentRequirements({
        scheme: "exact",
        payTo: RESOURCE_SERVER_ADDRESS as string,
        price: 150,
        network: SUI_TESTNET_CAIP2 as Network,
      });

      expect(largeRequirements[0].amount).toBe((150 * 1e9).toString());
      expect(largeRequirements[0].asset).toBe("0xcustom::token::LARGE");
      expect(largeRequirements[0].extra?.token).toBe("LARGE");
      expect(largeRequirements[0].extra?.tier).toBe("large");

      const smallRequirements = await server.buildPaymentRequirements({
        scheme: "exact",
        payTo: RESOURCE_SERVER_ADDRESS as string,
        price: 50,
        network: SUI_TESTNET_CAIP2 as Network,
      });

      expect(smallRequirements[0].amount).toBe("50000000");
      expect(smallRequirements[0].asset).toBe(USDC_TESTNET_COIN_TYPE);
    });

    it("should support multiple MoneyParser in chain", async () => {
      suiServer
        .registerMoneyParser(async (amount) => {
          if (amount > 1000) {
            return {
              amount: (amount * 1e9).toString(),
              asset: "0xvip::token::VIP",
              extra: { tier: "vip" },
            };
          }
          return null;
        })
        .registerMoneyParser(async (amount) => {
          if (amount > 100) {
            return {
              amount: (amount * 1e6).toString(),
              asset: "0xpremium::token::PREMIUM",
              extra: { tier: "premium" },
            };
          }
          return null;
        });

      const vipReq = await server.buildPaymentRequirements({
        scheme: "exact",
        payTo: RESOURCE_SERVER_ADDRESS as string,
        price: 2000,
        network: SUI_TESTNET_CAIP2 as Network,
      });
      expect(vipReq[0].extra?.tier).toBe("vip");
      expect(vipReq[0].asset).toBe("0xvip::token::VIP");

      const premiumReq = await server.buildPaymentRequirements({
        scheme: "exact",
        payTo: RESOURCE_SERVER_ADDRESS as string,
        price: 500,
        network: SUI_TESTNET_CAIP2 as Network,
      });
      expect(premiumReq[0].extra?.tier).toBe("premium");
      expect(premiumReq[0].asset).toBe("0xpremium::token::PREMIUM");

      const standardReq = await server.buildPaymentRequirements({
        scheme: "exact",
        payTo: RESOURCE_SERVER_ADDRESS as string,
        price: 50,
        network: SUI_TESTNET_CAIP2 as Network,
      });
      expect(standardReq[0].asset).toBe(USDC_TESTNET_COIN_TYPE);
    });

    it("should work with async MoneyParser (e.g., exchange rate lookup)", async () => {
      const mockExchangeRate = 0.98;

      suiServer.registerMoneyParser(async (amount, _network) => {
        await new Promise((resolve) => setTimeout(resolve, 10));

        const usdcAmount = amount * mockExchangeRate;
        return {
          amount: Math.floor(usdcAmount * 1e6).toString(),
          asset: USDC_TESTNET_COIN_TYPE,
          extra: {
            exchangeRate: mockExchangeRate,
            originalUSD: amount,
          },
        };
      });

      const requirements = await server.buildPaymentRequirements({
        scheme: "exact",
        payTo: RESOURCE_SERVER_ADDRESS as string,
        price: 100,
        network: SUI_TESTNET_CAIP2 as Network,
      });

      expect(requirements[0].amount).toBe("98000000");
      expect(requirements[0].extra?.exchangeRate).toBe(0.98);
      expect(requirements[0].extra?.originalUSD).toBe(100);
    });

    it("should avoid floating-point rounding error", async () => {
      const testCases = [
        { input: "$4.02", expectedAmount: "4020000" },
        { input: "4.02", expectedAmount: "4020000" },
        { input: 4.02, expectedAmount: "4020000" },
      ];

      for (const testCase of testCases) {
        const requirements = await server.buildPaymentRequirements({
          scheme: "exact",
          payTo: RESOURCE_SERVER_ADDRESS as string,
          price: testCase.input,
          network: SUI_TESTNET_CAIP2 as Network,
        });

        expect(requirements).toHaveLength(1);
        expect(requirements[0].amount).toBe(testCase.expectedAmount);
        expect(requirements[0].asset).toBe(USDC_TESTNET_COIN_TYPE);
      }
    });
  });
});

// Suppress unused-import warning — these are used by the integration tests
// when running with a real Sui RPC.
void SUI_TESTNET_GRPC_URL;
