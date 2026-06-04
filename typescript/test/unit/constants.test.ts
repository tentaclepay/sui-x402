import { describe, expect, it } from "vitest";

import {
  AUSD_MAINNET_COIN_TYPE,
  DEFAULT_GAS_BUDGET,
  FDUSD_MAINNET_COIN_TYPE,
  MAINNET_TOKEN_LIST,
  SUI_DEVNET_CAIP2,
  SUI_DEVNET_GRPC_URL,
  SUI_MAINNET_CAIP2,
  SUI_MAINNET_GRPC_URL,
  SUI_NETWORK_CAIP2_LIST,
  SUI_TESTNET_CAIP2,
  SUI_TESTNET_GRPC_URL,
  SUI_USDE_MAINNET_COIN_TYPE,
  TESTNET_TOKEN_LIST,
  USDB_MAINNET_COIN_TYPE,
  USDC_DECIMAL,
  USDC_MAINNET_COIN_TYPE,
  USDC_TESTNET_COIN_TYPE,
  USDSUI_DECIMAL,
  USDSUI_MAINNET_COIN_TYPE,
  USDY_MAINNET_COIN_TYPE,
} from "../../src/constants";

describe("Sui Constants", () => {
  describe("Network identifiers", () => {
    it("should have correct CAIP-2 format for mainnet", () => {
      expect(SUI_MAINNET_CAIP2).toBe("sui:mainnet");
    });

    it("should have correct CAIP-2 format for testnet", () => {
      expect(SUI_TESTNET_CAIP2).toBe("sui:testnet");
    });

    it("should have correct CAIP-2 format for devnet", () => {
      expect(SUI_DEVNET_CAIP2).toBe("sui:devnet");
    });

    it("should list all supported networks", () => {
      expect(SUI_NETWORK_CAIP2_LIST).toContain(SUI_MAINNET_CAIP2);
      expect(SUI_NETWORK_CAIP2_LIST).toContain(SUI_TESTNET_CAIP2);
      expect(SUI_NETWORK_CAIP2_LIST).toContain(SUI_DEVNET_CAIP2);
      expect(SUI_NETWORK_CAIP2_LIST).toHaveLength(3);
    });
  });

  describe("gRPC URLs", () => {
    it("should have valid mainnet gRPC URL", () => {
      expect(SUI_MAINNET_GRPC_URL).toBe("https://fullnode.mainnet.sui.io:443");
      expect(SUI_MAINNET_GRPC_URL.startsWith("https://")).toBe(true);
    });

    it("should have valid testnet gRPC URL", () => {
      expect(SUI_TESTNET_GRPC_URL).toBe("https://fullnode.testnet.sui.io:443");
      expect(SUI_TESTNET_GRPC_URL.startsWith("https://")).toBe(true);
    });

    it("should have valid devnet gRPC URL", () => {
      expect(SUI_DEVNET_GRPC_URL).toBe("https://fullnode.devnet.sui.io:443");
      expect(SUI_DEVNET_GRPC_URL.startsWith("https://")).toBe(true);
    });

    it("should return different URLs for different networks", () => {
      expect(SUI_MAINNET_GRPC_URL).not.toBe(SUI_TESTNET_GRPC_URL);
      expect(SUI_MAINNET_GRPC_URL).not.toBe(SUI_DEVNET_GRPC_URL);
      expect(SUI_TESTNET_GRPC_URL).not.toBe(SUI_DEVNET_GRPC_URL);
    });
  });

  describe("Token CoinTypes", () => {
    it("should have valid USDC mainnet CoinType", () => {
      expect(USDC_MAINNET_COIN_TYPE).toContain("::usdc::USDC");
      expect(USDC_MAINNET_COIN_TYPE.startsWith("0x")).toBe(true);
    });

    it("should have valid USDC testnet CoinType", () => {
      expect(USDC_TESTNET_COIN_TYPE).toContain("::usdc::USDC");
      expect(USDC_TESTNET_COIN_TYPE.startsWith("0x")).toBe(true);
    });

    it("should have valid USDSUI mainnet CoinType", () => {
      expect(USDSUI_MAINNET_COIN_TYPE).toContain("::usdsui::USDSUI");
    });

    it("should have valid SUI_USDE mainnet CoinType", () => {
      expect(SUI_USDE_MAINNET_COIN_TYPE).toContain("::sui_usde::SUI_USDE");
    });

    it("should have valid USDY mainnet CoinType", () => {
      expect(USDY_MAINNET_COIN_TYPE).toContain("::usdy::USDY");
    });

    it("should have valid FDUSD mainnet CoinType", () => {
      expect(FDUSD_MAINNET_COIN_TYPE).toContain("::fdusd::FDUSD");
    });

    it("should have valid AUSD mainnet CoinType", () => {
      expect(AUSD_MAINNET_COIN_TYPE).toContain("::ausd::AUSD");
    });

    it("should have valid USDB mainnet CoinType", () => {
      expect(USDB_MAINNET_COIN_TYPE).toContain("::usdb::USDB");
    });

    it("should have different USDC for mainnet and testnet", () => {
      expect(USDC_MAINNET_COIN_TYPE).not.toBe(USDC_TESTNET_COIN_TYPE);
    });
  });

  describe("Token lists", () => {
    it("should include USDC in mainnet token list", () => {
      expect(MAINNET_TOKEN_LIST).toContain(USDC_MAINNET_COIN_TYPE);
    });

    it("should list all mainnet tokens", () => {
      expect(MAINNET_TOKEN_LIST).toContain(USDC_MAINNET_COIN_TYPE);
      expect(MAINNET_TOKEN_LIST).toContain(USDSUI_MAINNET_COIN_TYPE);
      expect(MAINNET_TOKEN_LIST).toContain(SUI_USDE_MAINNET_COIN_TYPE);
      expect(MAINNET_TOKEN_LIST).toContain(USDY_MAINNET_COIN_TYPE);
      expect(MAINNET_TOKEN_LIST).toContain(FDUSD_MAINNET_COIN_TYPE);
      expect(MAINNET_TOKEN_LIST).toContain(AUSD_MAINNET_COIN_TYPE);
      expect(MAINNET_TOKEN_LIST).toContain(USDB_MAINNET_COIN_TYPE);
    });

    it("should include USDC in testnet token list", () => {
      expect(TESTNET_TOKEN_LIST).toContain(USDC_TESTNET_COIN_TYPE);
    });
  });

  describe("Token decimals", () => {
    it("should have correct USDC decimals", () => {
      expect(USDC_DECIMAL).toBe(6);
    });

    it("should have correct USDSUI decimals", () => {
      expect(USDSUI_DECIMAL).toBe(6);
    });
  });

  describe("Gas budget", () => {
    it("should expose the default facilitator gas budget as a bigint", () => {
      expect(DEFAULT_GAS_BUDGET).toBe(2_000_000n);
      expect(typeof DEFAULT_GAS_BUDGET).toBe("bigint");
    });
  });
});
