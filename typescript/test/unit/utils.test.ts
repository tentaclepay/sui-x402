import { describe, expect, it } from "vitest";

import {
  SUI_DEVNET_CAIP2,
  SUI_MAINNET_CAIP2,
  SUI_TESTNET_CAIP2,
  USDC_MAINNET_COIN_TYPE,
  USDC_TESTNET_COIN_TYPE,
} from "../../src/constants";
import { getUsdcCoinType, isValidNetwork } from "../../src/utils";

describe("Sui Utils", () => {
  describe("getUsdcCoinType", () => {
    it("should return mainnet USDC CoinType", () => {
      expect(getUsdcCoinType(SUI_MAINNET_CAIP2)).toBe(USDC_MAINNET_COIN_TYPE);
    });

    it("should return testnet USDC CoinType", () => {
      expect(getUsdcCoinType(SUI_TESTNET_CAIP2)).toBe(USDC_TESTNET_COIN_TYPE);
    });

    it("should throw for devnet (no configured USDC)", () => {
      expect(() => getUsdcCoinType(SUI_DEVNET_CAIP2)).toThrow(
        /No USDC CoinType configured/
      );
    });

    it("should throw for unsupported networks", () => {
      expect(() => getUsdcCoinType("sui:unknown")).toThrow(
        /No USDC CoinType configured/
      );
      expect(() => getUsdcCoinType("ethereum:1")).toThrow(
        /No USDC CoinType configured/
      );
      expect(() => getUsdcCoinType("solana:mainnet")).toThrow(
        /No USDC CoinType configured/
      );
    });
  });

  describe("isValidNetwork", () => {
    it("should return true for Sui mainnet CAIP-2", () => {
      expect(isValidNetwork(SUI_MAINNET_CAIP2)).toBe(true);
    });

    it("should return true for Sui testnet CAIP-2", () => {
      expect(isValidNetwork(SUI_TESTNET_CAIP2)).toBe(true);
    });

    it("should return true for Sui devnet CAIP-2", () => {
      expect(isValidNetwork(SUI_DEVNET_CAIP2)).toBe(true);
    });

    it("should return false for non-Sui networks", () => {
      expect(isValidNetwork("ethereum:1")).toBe(false);
      expect(isValidNetwork("solana:mainnet")).toBe(false);
      expect(isValidNetwork("aptos:1")).toBe(false);
    });

    it("should return false for malformed network strings", () => {
      expect(isValidNetwork("sui")).toBe(false);
      expect(isValidNetwork("")).toBe(false);
      expect(isValidNetwork("sui:")).toBe(false);
      expect(isValidNetwork("sui:unknown")).toBe(false);
    });

    it("should narrow the type when true", () => {
      const candidate: string = SUI_MAINNET_CAIP2;
      if (isValidNetwork(candidate)) {
        // type-narrowed to SuiNetwork — usable in switch on getUsdcCoinType
        expect(getUsdcCoinType(candidate)).toBe(USDC_MAINNET_COIN_TYPE);
      }
    });
  });
});
