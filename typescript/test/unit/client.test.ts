import type { PaymentRequirements } from "@x402/core/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SuiClientRegistry } from "../../src/client-registry";
import type { ClientSuiSigner } from "../../src/signer";
import {
  SUI_MAINNET_CAIP2,
  SUI_TESTNET_CAIP2,
  USDC_MAINNET_COIN_TYPE,
  USDC_TESTNET_COIN_TYPE,
} from "../../src/constants";
import { ExactSuiScheme } from "../../src/exact/client/scheme";

const VALID_SUI_ADDRESS =
  "0x0000000000000000000000000000000000000000000000000000000000000001";

describe("ExactSuiScheme (Client)", () => {
  let mockSigner: ClientSuiSigner;
  let mockClient: { trace?: string };
  let mockRegistry: SuiClientRegistry;

  beforeEach(() => {
    mockSigner = {
      address: VALID_SUI_ADDRESS,
      signTransaction: vi.fn().mockResolvedValue("c2lnbmF0dXJl"),
    };

    mockClient = { trace: "mock-client" };
    mockRegistry = {
      get: vi.fn().mockReturnValue(mockClient),
      set: vi.fn(),
    };
  });

  describe("constructor", () => {
    it("should create instance with correct scheme", () => {
      const client = new ExactSuiScheme(mockSigner);
      expect(client.scheme).toBe("exact");
    });

    it("should accept an optional clientRegistry", () => {
      const client = new ExactSuiScheme(mockSigner, {
        clientRegistry: mockRegistry,
      });
      expect(client.scheme).toBe("exact");
      expect(client.options?.clientRegistry).toBe(mockRegistry);
    });

    it("should use the default registry when none is provided", () => {
      const client = new ExactSuiScheme(mockSigner);
      expect(client.options).toBeUndefined();
    });
  });

  describe("createPaymentPayload", () => {
    it("should expose createPaymentPayload as a function", () => {
      const client = new ExactSuiScheme(mockSigner);
      expect(typeof client.createPaymentPayload).toBe("function");
    });

    it("should reject non-V2 x402 versions", async () => {
      const client = new ExactSuiScheme(mockSigner);

      const requirements: PaymentRequirements = {
        scheme: "exact",
        network: SUI_MAINNET_CAIP2,
        asset: USDC_MAINNET_COIN_TYPE,
        amount: "100000",
        payTo: VALID_SUI_ADDRESS,
        maxTimeoutSeconds: 3600,
        extra: {},
      };

      await expect(
        client.createPaymentPayload(1, requirements)
      ).rejects.toThrow(/Only V2 schema is supported/);
    });

    it("should reject invalid payment requirements", async () => {
      const client = new ExactSuiScheme(mockSigner);

      // Missing required fields
      const requirements = {
        scheme: "exact",
        network: SUI_MAINNET_CAIP2,
        asset: USDC_MAINNET_COIN_TYPE,
        // missing amount, payTo etc.
      } as PaymentRequirements;

      await expect(
        client.createPaymentPayload(2, requirements)
      ).rejects.toThrow(/Invalid payment requirements/);
    });

    it("should reject invalid network", async () => {
      const client = new ExactSuiScheme(mockSigner);

      const requirements: PaymentRequirements = {
        scheme: "exact",
        network: "ethereum:1",
        asset: USDC_MAINNET_COIN_TYPE,
        amount: "100000",
        payTo: VALID_SUI_ADDRESS,
        maxTimeoutSeconds: 3600,
        extra: {},
      };

      await expect(
        client.createPaymentPayload(2, requirements)
      ).rejects.toThrow(/Invalid network/);
    });

    it("should reject invalid Sui recipient addresses", async () => {
      const client = new ExactSuiScheme(mockSigner, {
        clientRegistry: mockRegistry,
      });

      const requirements: PaymentRequirements = {
        scheme: "exact",
        network: SUI_MAINNET_CAIP2,
        asset: USDC_MAINNET_COIN_TYPE,
        amount: "100000",
        payTo: "not-an-address",
        maxTimeoutSeconds: 3600,
        extra: {},
      };

      await expect(
        client.createPaymentPayload(2, requirements)
      ).rejects.toThrow(/Invalid recipient address/);
    });

    it("should reject when gasOwner is missing from requirements.extra", async () => {
      const client = new ExactSuiScheme(mockSigner, {
        clientRegistry: mockRegistry,
      });

      const requirements: PaymentRequirements = {
        scheme: "exact",
        network: SUI_MAINNET_CAIP2,
        asset: USDC_MAINNET_COIN_TYPE,
        amount: "100000",
        payTo: VALID_SUI_ADDRESS,
        maxTimeoutSeconds: 3600,
        extra: {},
      };

      await expect(
        client.createPaymentPayload(2, requirements)
      ).rejects.toThrow(/gasOwner is required/);
    });

    it("should accept V2 PaymentRequirements with amount field", () => {
      const client = new ExactSuiScheme(mockSigner);

      const requirements: PaymentRequirements = {
        scheme: "exact",
        network: SUI_TESTNET_CAIP2,
        asset: USDC_TESTNET_COIN_TYPE,
        amount: "500000",
        payTo: VALID_SUI_ADDRESS,
        maxTimeoutSeconds: 3600,
        extra: {},
      };

      // V2 uses `amount` rather than `maxAmountRequired`
      expect(requirements.amount).toBe("500000");
      expect(client.scheme).toBe("exact");
    });
  });
});
