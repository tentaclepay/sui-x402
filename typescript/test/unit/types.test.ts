import { describe, expect, it } from "vitest";

import type { ExactSuiPayload, SuiAddress } from "../../src/types";

describe("Sui Types", () => {
  describe("ExactSuiPayload", () => {
    it("should accept valid payload structure", () => {
      const payload: ExactSuiPayload = {
        transaction: "dGVzdA==",
        signature: "c2lnbmF0dXJl",
      };

      expect(payload.transaction).toBeDefined();
      expect(payload.signature).toBeDefined();
      expect(typeof payload.transaction).toBe("string");
      expect(typeof payload.signature).toBe("string");
    });

    it("should have both transaction and signature fields", () => {
      const payload: ExactSuiPayload = {
        transaction: "AAAA",
        signature: "AAAB",
      };

      expect(Object.keys(payload)).toContain("transaction");
      expect(Object.keys(payload)).toContain("signature");
    });
  });

  describe("SuiAddress", () => {
    it("should accept 0x-prefixed addresses at the type level", () => {
      const addr: SuiAddress = "0x1234567890abcdef";
      expect(addr.startsWith("0x")).toBe(true);
    });
  });
});
