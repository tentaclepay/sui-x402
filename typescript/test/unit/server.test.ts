import type { PaymentRequirements } from "@x402/core/types";
import { describe, expect, it } from "vitest";

import {
  SUI_DEVNET_CAIP2,
  SUI_MAINNET_CAIP2,
  SUI_TESTNET_CAIP2,
  USDC_MAINNET_COIN_TYPE,
  USDC_TESTNET_COIN_TYPE,
} from "../../src/constants";
import { ExactSuiScheme } from "../../src/exact/server/scheme";

describe("ExactSuiScheme (Server)", () => {
  const server = new ExactSuiScheme();

  describe("scheme", () => {
    it("should have scheme set to 'exact'", () => {
      expect(server.scheme).toBe("exact");
    });
  });

  describe("parsePrice", () => {
    describe("Sui Mainnet network", () => {
      const network = SUI_MAINNET_CAIP2;

      it("should parse dollar string prices", async () => {
        const result = await server.parsePrice("$0.10", network);
        expect(result.amount).toBe("100000");
        expect(result.asset).toBe(USDC_MAINNET_COIN_TYPE);
      });

      it("should parse simple number string prices", async () => {
        const result = await server.parsePrice("0.10", network);
        expect(result.amount).toBe("100000");
        expect(result.asset).toBe(USDC_MAINNET_COIN_TYPE);
      });

      it("should parse number prices", async () => {
        const result = await server.parsePrice(0.1, network);
        expect(result.amount).toBe("100000");
        expect(result.asset).toBe(USDC_MAINNET_COIN_TYPE);
      });

      it("should handle larger amounts", async () => {
        const result = await server.parsePrice("100.50", network);
        expect(result.amount).toBe("100500000");
      });

      it("should handle whole numbers", async () => {
        const result = await server.parsePrice("1", network);
        expect(result.amount).toBe("1000000");
      });

      it("should avoid floating-point rounding error", async () => {
        const result = await server.parsePrice("$4.02", network);
        expect(result.amount).toBe("4020000");
      });
    });

    describe("Sui Testnet network", () => {
      const network = SUI_TESTNET_CAIP2;

      it("should use testnet USDC CoinType", async () => {
        const result = await server.parsePrice("1.00", network);
        expect(result.asset).toBe(USDC_TESTNET_COIN_TYPE);
        expect(result.amount).toBe("1000000");
      });
    });

    describe("Sui Devnet network", () => {
      it("should throw when no USDC is configured for devnet", async () => {
        await expect(
          server.parsePrice("1.00", SUI_DEVNET_CAIP2)
        ).rejects.toThrow(/No USDC CoinType configured/);
      });
    });

    describe("pre-parsed AssetAmount objects", () => {
      it("should pass through AssetAmount with asset", async () => {
        const result = await server.parsePrice(
          {
            amount: "123456",
            asset: "0xcustom::coin::COIN",
            extra: { foo: "bar" },
          },
          SUI_MAINNET_CAIP2
        );
        expect(result.amount).toBe("123456");
        expect(result.asset).toBe("0xcustom::coin::COIN");
        expect(result.extra).toEqual({ foo: "bar" });
      });

      it("should preserve empty extra object", async () => {
        const result = await server.parsePrice(
          {
            amount: "1",
            asset: "0xa::b::C",
          } as never,
          SUI_MAINNET_CAIP2
        );
        expect(result.extra).toEqual({});
      });

      it("should throw for AssetAmount without an asset (CoinType)", async () => {
        await expect(
          server.parsePrice({ amount: "123456" } as never, SUI_MAINNET_CAIP2)
        ).rejects.toThrow(/CoinType \(asset\) must be specified/);
      });
    });

    describe("error cases", () => {
      it("should throw for invalid money formats", async () => {
        await expect(
          server.parsePrice("not-a-price!", SUI_MAINNET_CAIP2)
        ).rejects.toThrow(/Invalid money format/);
      });

      it("should throw for invalid amounts", async () => {
        await expect(
          server.parsePrice("abc", SUI_MAINNET_CAIP2)
        ).rejects.toThrow(/Invalid money format/);
      });
    });
  });

  describe("registerMoneyParser", () => {
    it("should register a custom money parser", async () => {
      const customServer = new ExactSuiScheme();
      customServer.registerMoneyParser(async (amount) => {
        if (amount === 42) {
          return {
            amount: "42000000",
            asset: "0xcustom::token::CUSTOM",
            extra: {},
          };
        }
        return null;
      });

      const result = await customServer.parsePrice(42, SUI_MAINNET_CAIP2);
      expect(result.amount).toBe("42000000");
      expect(result.asset).toBe("0xcustom::token::CUSTOM");
    });

    it("should fall back to default when custom parser returns null", async () => {
      const customServer = new ExactSuiScheme();
      customServer.registerMoneyParser(async () => null);

      const result = await customServer.parsePrice(1, SUI_MAINNET_CAIP2);
      expect(result.amount).toBe("1000000");
      expect(result.asset).toBe(USDC_MAINNET_COIN_TYPE);
    });

    it("should chain registerMoneyParser calls", () => {
      const customServer = new ExactSuiScheme();
      const result = customServer
        .registerMoneyParser(async () => null)
        .registerMoneyParser(async () => null);

      expect(result).toBe(customServer);
    });

    it("should try parsers in registration order", async () => {
      const customServer = new ExactSuiScheme();
      customServer
        .registerMoneyParser(async (amount) => {
          if (amount > 0)
            return { amount: "first", asset: "0xfirst::a::A", extra: {} };
          return null;
        })
        .registerMoneyParser(async (amount) => {
          if (amount > 0)
            return { amount: "second", asset: "0xsecond::a::A", extra: {} };
          return null;
        });

      const result = await customServer.parsePrice(1, SUI_MAINNET_CAIP2);
      expect(result.amount).toBe("first");
    });

    it("should support async parsers", async () => {
      const customServer = new ExactSuiScheme();
      customServer.registerMoneyParser(async (amount) => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return {
          amount: (amount * 1_000_000).toString(),
          asset: "0xasync::a::A",
          extra: { async: true },
        };
      });

      const result = await customServer.parsePrice(7, SUI_MAINNET_CAIP2);
      expect(result.amount).toBe("7000000");
      expect(result.asset).toBe("0xasync::a::A");
      expect(result.extra).toEqual({ async: true });
    });
  });

  describe("enhancePaymentRequirements", () => {
    it("should add gasOwner from supportedKind extra", async () => {
      const requirements: PaymentRequirements = {
        scheme: "exact",
        network: SUI_MAINNET_CAIP2,
        asset: USDC_MAINNET_COIN_TYPE,
        amount: "100000",
        payTo: "0xabc",
        maxTimeoutSeconds: 3600,
        extra: {},
      };

      const result = await server.enhancePaymentRequirements(
        requirements,
        {
          x402Version: 2,
          scheme: "exact",
          network: SUI_MAINNET_CAIP2,
          extra: { gasOwner: "0xsponsor" },
        },
        []
      );

      expect(result.extra?.gasOwner).toBe("0xsponsor");
    });

    it("should preserve existing extra fields", async () => {
      const requirements: PaymentRequirements = {
        scheme: "exact",
        network: SUI_MAINNET_CAIP2,
        asset: USDC_MAINNET_COIN_TYPE,
        amount: "100000",
        payTo: "0xabc",
        maxTimeoutSeconds: 3600,
        extra: { custom: "value" },
      };

      const result = await server.enhancePaymentRequirements(
        requirements,
        {
          x402Version: 2,
          scheme: "exact",
          network: SUI_MAINNET_CAIP2,
          extra: { gasOwner: "0xsponsor" },
        },
        []
      );

      expect(result.extra).toEqual({
        custom: "value",
        gasOwner: "0xsponsor",
      });
    });

    it("should not error when supportedKind has no gasOwner", async () => {
      const requirements: PaymentRequirements = {
        scheme: "exact",
        network: SUI_MAINNET_CAIP2,
        asset: USDC_MAINNET_COIN_TYPE,
        amount: "100000",
        payTo: "0xabc",
        maxTimeoutSeconds: 3600,
        extra: {},
      };

      const result = await server.enhancePaymentRequirements(
        requirements,
        {
          x402Version: 2,
          scheme: "exact",
          network: SUI_MAINNET_CAIP2,
          extra: {},
        },
        []
      );

      expect(result.extra?.gasOwner).toBeUndefined();
    });
  });
});
