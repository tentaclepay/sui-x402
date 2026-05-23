import { describe, expect, it } from "vitest";

import type { ExactSuiPayload, SuiAddress } from "../../src/types";
import { exactSuiPayloadSchema } from "../../src/types";

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

  describe("exactSuiPayloadSchema", () => {
    it("should accept valid base64 transaction and signature", () => {
      const result = exactSuiPayloadSchema.safeParse({
        transaction: "dGVzdA==",
        signature: "c2lnbmF0dXJl",
      });

      expect(result.success).toBe(true);
    });

    it("should reject missing transaction", () => {
      const result = exactSuiPayloadSchema.safeParse({
        signature: "c2lnbmF0dXJl",
      });

      expect(result.success).toBe(false);
    });

    it("should reject missing signature", () => {
      const result = exactSuiPayloadSchema.safeParse({
        transaction: "dGVzdA==",
      });

      expect(result.success).toBe(false);
    });

    it("should reject non-base64 transaction", () => {
      const result = exactSuiPayloadSchema.safeParse({
        transaction: "!!!not-base64!!!",
        signature: "c2lnbmF0dXJl",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(JSON.stringify(result.error)).toContain("Invalid transaction");
      }
    });

    it("should reject non-base64 signature", () => {
      const result = exactSuiPayloadSchema.safeParse({
        transaction: "dGVzdA==",
        signature: "!!!not-base64!!!",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(JSON.stringify(result.error)).toContain("Invalid signature");
      }
    });

    it("should reject non-string types", () => {
      expect(
        exactSuiPayloadSchema.safeParse({
          transaction: 123,
          signature: "c2lnbmF0dXJl",
        }).success
      ).toBe(false);

      expect(
        exactSuiPayloadSchema.safeParse({
          transaction: "dGVzdA==",
          signature: null,
        }).success
      ).toBe(false);
    });

    it("should reject completely empty payload", () => {
      const result = exactSuiPayloadSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });
});
