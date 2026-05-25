import { describe, expect, it } from "vitest";

import { createSuiClientRegistry } from "../../src/client-registry";
import {
  SUI_DEVNET_CAIP2,
  SUI_MAINNET_CAIP2,
  SUI_NETWORK_CAIP2_LIST,
  SUI_TESTNET_CAIP2,
  USDC_MAINNET_COIN_TYPE,
  USDC_TESTNET_COIN_TYPE,
} from "../../src/constants";
import { ExactSuiScheme as ExactSuiClient } from "../../src/exact/client/scheme";
import { ExactSuiScheme as ExactSuiFacilitator } from "../../src/exact/facilitator/scheme";
import { ExactSuiScheme as ExactSuiServer } from "../../src/exact/server/scheme";
import { toFacilitatorSuiSigner } from "../../src/signer";
import { exactSuiPayloadSchema } from "../../src/types";
import { getUsdcCoinType, isValidNetwork } from "../../src/utils";

describe("@tentaclepay/sui-x402 exports", () => {
  it("should export main scheme classes", () => {
    expect(ExactSuiClient).toBeDefined();
    expect(ExactSuiFacilitator).toBeDefined();
    expect(ExactSuiServer).toBeDefined();
  });

  it("should export network constants", () => {
    expect(SUI_MAINNET_CAIP2).toBe("sui:mainnet");
    expect(SUI_TESTNET_CAIP2).toBe("sui:testnet");
    expect(SUI_DEVNET_CAIP2).toBe("sui:devnet");
    expect(SUI_NETWORK_CAIP2_LIST).toHaveLength(3);
  });

  it("should export USDC CoinTypes", () => {
    expect(USDC_MAINNET_COIN_TYPE).toContain("::usdc::USDC");
    expect(USDC_TESTNET_COIN_TYPE).toContain("::usdc::USDC");
  });

  it("should export utility functions", () => {
    expect(getUsdcCoinType).toBeDefined();
    expect(isValidNetwork).toBeDefined();
  });

  it("should export client registry factory", () => {
    expect(createSuiClientRegistry).toBeDefined();
    const registry = createSuiClientRegistry();
    expect(registry.get).toBeDefined();
    expect(registry.set).toBeDefined();
  });

  it("should export signer helpers", () => {
    expect(toFacilitatorSuiSigner).toBeDefined();
  });

  it("should export the payload zod schema", () => {
    expect(exactSuiPayloadSchema).toBeDefined();
    expect(typeof exactSuiPayloadSchema.safeParse).toBe("function");
  });

  describe("integration of exported pieces", () => {
    it("should let server.parsePrice round-trip for mainnet USDC", async () => {
      const server = new ExactSuiServer();
      const result = await server.parsePrice("1.00", SUI_MAINNET_CAIP2);

      expect(result.asset).toBe(USDC_MAINNET_COIN_TYPE);
      expect(result.amount).toBe("1000000");
    });

    it("should let utils.getUsdcCoinType match server.parsePrice asset", async () => {
      const server = new ExactSuiServer();
      const parsed = await server.parsePrice("1.00", SUI_TESTNET_CAIP2);
      expect(parsed.asset).toBe(getUsdcCoinType(SUI_TESTNET_CAIP2));
    });
  });
});
