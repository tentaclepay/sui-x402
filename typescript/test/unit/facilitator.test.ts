import type { PaymentPayload, PaymentRequirements } from "@x402/core/types";
import { Transaction } from "@mysten/sui/transactions";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SuiClientRegistry } from "../../src/client-registry";
import type { FacilitatorSuiSigner } from "../../src/signer";
import {
  SUI_MAINNET_CAIP2,
  SUI_TESTNET_CAIP2,
  USDC_MAINNET_COIN_TYPE,
  USDC_TESTNET_COIN_TYPE,
} from "../../src/constants";
import { ExactSuiScheme } from "../../src/exact/facilitator/scheme";

const FACILITATOR_ADDRESS =
  "0x0000000000000000000000000000000000000000000000000000000000000099";
const PAY_TO_ADDRESS =
  "0x0000000000000000000000000000000000000000000000000000000000000001";
const GAS_BUDGET = 2_000_000n;

async function buildEmptySendFundsTxBase64(): Promise<string> {
  const tx = new Transaction();
  tx.setSender(
    "0x0000000000000000000000000000000000000000000000000000000000000099"
  );
  tx.setGasOwner(FACILITATOR_ADDRESS);
  tx.setGasPayment([]);
  tx.setGasPrice(1000);
  tx.setGasBudget(10_000_000);
  tx.setExpiration({ Epoch: 0 });
  const bytes = await tx.build();
  return Buffer.from(bytes).toString("base64");
}

describe("ExactSuiScheme (Facilitator)", () => {
  let mockSigner: FacilitatorSuiSigner;
  let mockRegistry: SuiClientRegistry;

  beforeEach(() => {
    mockSigner = {
      getAddresses: vi.fn().mockReturnValue([FACILITATOR_ADDRESS]),
      getGasBudget: vi.fn().mockReturnValue(GAS_BUDGET),
      signTransaction: vi.fn().mockResolvedValue("signedTx"),
    };

    mockRegistry = {
      get: vi.fn().mockReturnValue({
        simulateTransaction: vi.fn(),
        executeTransaction: vi.fn(),
      }),
      set: vi.fn(),
    };
  });

  describe("constructor", () => {
    it("should create instance with correct scheme", () => {
      const facilitator = new ExactSuiScheme(mockSigner);
      expect(facilitator.scheme).toBe("exact");
    });

    it("should expose the caipFamily", () => {
      const facilitator = new ExactSuiScheme(mockSigner);
      expect(facilitator.caipFamily).toBe("sui:*");
    });

    it("should accept an optional clientRegistry", () => {
      const facilitator = new ExactSuiScheme(mockSigner, {
        clientRegistry: mockRegistry,
      });
      expect(facilitator.scheme).toBe("exact");
    });
  });

  describe("getExtra", () => {
    it("should return a gasOwner selected from the signer addresses", () => {
      const facilitator = new ExactSuiScheme(mockSigner);
      const extra = facilitator.getExtra(SUI_MAINNET_CAIP2);

      expect(extra).toEqual({
        gasOwner: FACILITATOR_ADDRESS,
        gasBudget: GAS_BUDGET,
      });
    });

    it("should include the gas budget reported by the signer", () => {
      const customSigner: FacilitatorSuiSigner = {
        getAddresses: vi.fn().mockReturnValue([FACILITATOR_ADDRESS]),
        getGasBudget: vi.fn().mockReturnValue(9_000_000n),
        signTransaction: vi.fn(),
      };
      const facilitator = new ExactSuiScheme(customSigner);

      const extra = facilitator.getExtra(SUI_MAINNET_CAIP2) as {
        gasBudget: bigint;
      };

      expect(extra.gasBudget).toBe(9_000_000n);
    });

    it("should not depend on the network argument", () => {
      const facilitator = new ExactSuiScheme(mockSigner);
      // Single-address signer makes the random pick deterministic so we can
      // compare across calls without flake.
      expect(facilitator.getExtra(SUI_MAINNET_CAIP2)).toEqual(
        facilitator.getExtra(SUI_TESTNET_CAIP2)
      );
    });

    it("should pick a gasOwner from the available signer addresses", () => {
      const otherAddress =
        "0x00000000000000000000000000000000000000000000000000000000000000aa";
      const multiSigner: FacilitatorSuiSigner = {
        getAddresses: vi
          .fn()
          .mockReturnValue([FACILITATOR_ADDRESS, otherAddress]),
        getGasBudget: vi.fn().mockReturnValue(GAS_BUDGET),
        signTransaction: vi.fn(),
      };
      const facilitator = new ExactSuiScheme(multiSigner);

      const extra = facilitator.getExtra(SUI_MAINNET_CAIP2) as {
        gasOwner: string;
      };

      expect([FACILITATOR_ADDRESS, otherAddress]).toContain(extra.gasOwner);
    });
  });

  describe("getSigners", () => {
    it("should return the signer addresses", () => {
      const facilitator = new ExactSuiScheme(mockSigner);
      const signers = facilitator.getSigners(SUI_MAINNET_CAIP2);

      expect(signers).toEqual([FACILITATOR_ADDRESS]);
    });

    it("should return a fresh array (not a frozen tuple)", () => {
      const facilitator = new ExactSuiScheme(mockSigner);
      const signers = facilitator.getSigners(SUI_MAINNET_CAIP2);

      // Spread copy means the array should be mutable
      expect(() => signers.push("0x123")).not.toThrow();
    });

    it("should reflect multiple addresses from the signer", () => {
      const multiSigner: FacilitatorSuiSigner = {
        getAddresses: vi.fn().mockReturnValue([FACILITATOR_ADDRESS, "0xabc"]),
        getGasBudget: vi.fn().mockReturnValue(GAS_BUDGET),
        signTransaction: vi.fn(),
      };
      const facilitator = new ExactSuiScheme(multiSigner);
      const signers = facilitator.getSigners(SUI_MAINNET_CAIP2);

      expect(signers).toEqual([FACILITATOR_ADDRESS, "0xabc"]);
    });
  });

  describe("verify", () => {
    it("should reject if scheme does not match", async () => {
      const facilitator = new ExactSuiScheme(mockSigner, {
        clientRegistry: mockRegistry,
      });

      const payload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: "wrong",
          network: SUI_MAINNET_CAIP2,
          asset: USDC_MAINNET_COIN_TYPE,
          amount: "100000",
          payTo: PAY_TO_ADDRESS,
          maxTimeoutSeconds: 3600,
          extra: {},
        },
        payload: {
          transaction: "dGVzdA==",
          signature: "c2ln",
        },
      };

      const requirements: PaymentRequirements = {
        scheme: "exact",
        network: SUI_MAINNET_CAIP2,
        asset: USDC_MAINNET_COIN_TYPE,
        amount: "100000",
        payTo: PAY_TO_ADDRESS,
        maxTimeoutSeconds: 3600,
        extra: {},
      };

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("scheme_mismatch");
    });

    it("should reject if network is not a supported Sui network", async () => {
      const facilitator = new ExactSuiScheme(mockSigner, {
        clientRegistry: mockRegistry,
      });

      const payload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: "exact",
          network: "ethereum:1",
          asset: USDC_MAINNET_COIN_TYPE,
          amount: "100000",
          payTo: PAY_TO_ADDRESS,
          maxTimeoutSeconds: 3600,
          extra: {},
        },
        payload: {
          transaction: "dGVzdA==",
          signature: "c2ln",
        },
      };

      const requirements: PaymentRequirements = {
        scheme: "exact",
        network: SUI_MAINNET_CAIP2,
        asset: USDC_MAINNET_COIN_TYPE,
        amount: "100000",
        payTo: PAY_TO_ADDRESS,
        maxTimeoutSeconds: 3600,
        extra: {},
      };

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("network_mismatch");
    });

    it("should reject if the payload transaction is not a sponsored send_funds", async () => {
      const facilitator = new ExactSuiScheme(mockSigner, {
        clientRegistry: mockRegistry,
      });

      // Real, decodable transaction — but no send_funds command at all
      const transactionBase64 = await buildEmptySendFundsTxBase64();

      const payload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: "exact",
          network: SUI_TESTNET_CAIP2,
          asset: USDC_TESTNET_COIN_TYPE,
          amount: "100000",
          payTo: PAY_TO_ADDRESS,
          maxTimeoutSeconds: 3600,
          extra: { gasOwner: FACILITATOR_ADDRESS },
        },
        payload: {
          transaction: transactionBase64,
          signature: "c2lnbmF0dXJl",
        },
      };

      const requirements: PaymentRequirements = {
        scheme: "exact",
        network: SUI_TESTNET_CAIP2,
        asset: USDC_TESTNET_COIN_TYPE,
        amount: "100000",
        payTo: PAY_TO_ADDRESS,
        maxTimeoutSeconds: 3600,
        extra: { gasOwner: FACILITATOR_ADDRESS },
      };

      const result = await facilitator.verify(payload, requirements);

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("invalid_transaction");
    });
  });

  describe("settle", () => {
    it("should propagate verification failures as a successful response with errorReason", async () => {
      const facilitator = new ExactSuiScheme(mockSigner, {
        clientRegistry: mockRegistry,
      });

      const payload: PaymentPayload = {
        x402Version: 2,
        accepted: {
          scheme: "wrong",
          network: SUI_MAINNET_CAIP2,
          asset: USDC_MAINNET_COIN_TYPE,
          amount: "100000",
          payTo: PAY_TO_ADDRESS,
          maxTimeoutSeconds: 3600,
          extra: {},
        },
        payload: {
          transaction: "dGVzdA==",
          signature: "c2ln",
        },
      };

      const requirements: PaymentRequirements = {
        scheme: "exact",
        network: SUI_MAINNET_CAIP2,
        asset: USDC_MAINNET_COIN_TYPE,
        amount: "100000",
        payTo: PAY_TO_ADDRESS,
        maxTimeoutSeconds: 3600,
        extra: {},
      };

      const result = await facilitator.settle(payload, requirements);

      // The implementation returns `success: true` but with an errorReason —
      // mirrors the contract used by other mechanisms when verify fails first.
      expect(result.errorReason).toBe("scheme_mismatch");
      expect(result.network).toBe(SUI_MAINNET_CAIP2);
    });
  });
});
