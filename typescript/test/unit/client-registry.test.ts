import { SuiGrpcClient } from "@mysten/sui/grpc";
import { describe, expect, it } from "vitest";

import { createSuiClientRegistry } from "../../src/client-registry";
import {
  SUI_DEVNET_CAIP2,
  SUI_MAINNET_CAIP2,
  SUI_TESTNET_CAIP2,
} from "../../src/constants";

describe("SuiClientRegistry", () => {
  it("should create a registry with default clients for all networks", () => {
    const registry = createSuiClientRegistry();

    expect(registry.get(SUI_MAINNET_CAIP2)).toBeDefined();
    expect(registry.get(SUI_TESTNET_CAIP2)).toBeDefined();
    expect(registry.get(SUI_DEVNET_CAIP2)).toBeDefined();
  });

  it("should return SuiGrpcClient instances", () => {
    const registry = createSuiClientRegistry();

    expect(registry.get(SUI_MAINNET_CAIP2)).toBeInstanceOf(SuiGrpcClient);
    expect(registry.get(SUI_TESTNET_CAIP2)).toBeInstanceOf(SuiGrpcClient);
    expect(registry.get(SUI_DEVNET_CAIP2)).toBeInstanceOf(SuiGrpcClient);
  });

  it("should allow overriding a network client", () => {
    const registry = createSuiClientRegistry();
    const custom = new SuiGrpcClient({
      network: "mainnet",
      baseUrl: "https://custom.example.com",
    });

    registry.set(SUI_MAINNET_CAIP2, custom);

    expect(registry.get(SUI_MAINNET_CAIP2)).toBe(custom);
  });

  it("should keep other networks intact when overriding one", () => {
    const registry = createSuiClientRegistry();

    const originalTestnet = registry.get(SUI_TESTNET_CAIP2);
    const customMainnet = new SuiGrpcClient({
      network: "mainnet",
      baseUrl: "https://custom.example.com",
    });

    registry.set(SUI_MAINNET_CAIP2, customMainnet);

    expect(registry.get(SUI_TESTNET_CAIP2)).toBe(originalTestnet);
  });

  it("should return distinct clients for distinct networks", () => {
    const registry = createSuiClientRegistry();

    expect(registry.get(SUI_MAINNET_CAIP2)).not.toBe(
      registry.get(SUI_TESTNET_CAIP2)
    );
    expect(registry.get(SUI_TESTNET_CAIP2)).not.toBe(
      registry.get(SUI_DEVNET_CAIP2)
    );
  });
});
