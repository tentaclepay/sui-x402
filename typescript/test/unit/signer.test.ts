import { describe, expect, it, vi } from "vitest";

import type { ClientSuiSigner, FacilitatorSuiSigner } from "../../src/signer";
import { toFacilitatorSuiSigner } from "../../src/signer";

describe("Sui Signer", () => {
  describe("ClientSuiSigner", () => {
    it("should have the required structure", () => {
      const signer: ClientSuiSigner = {
        address: "0x1234567890abcdef",
        signTransaction: vi.fn().mockResolvedValue("signature"),
      };

      expect(signer.address).toBe("0x1234567890abcdef");
      expect(typeof signer.signTransaction).toBe("function");
    });

    it("should be able to sign a transaction", async () => {
      const signer: ClientSuiSigner = {
        address: "0xabc",
        signTransaction: vi.fn().mockResolvedValue("base64Signature=="),
      };

      const result = await signer.signTransaction("base64Transaction==");
      expect(result).toBe("base64Signature==");
      expect(signer.signTransaction).toHaveBeenCalledWith(
        "base64Transaction=="
      );
    });
  });

  describe("toFacilitatorSuiSigner", () => {
    it("should create facilitator signer with required methods", () => {
      const input = {
        address: "0xabc123" as `0x${string}`,
        signTransaction: vi.fn().mockResolvedValue("signedTx") as never,
      };

      const result = toFacilitatorSuiSigner(input);

      expect(result.getAddresses).toBeDefined();
      expect(typeof result.getAddresses).toBe("function");
      expect(result.signTransaction).toBeDefined();
      expect(typeof result.signTransaction).toBe("function");
    });

    it("should return the signer address from getAddresses", () => {
      const input = {
        address: "0xabc123" as `0x${string}`,
        signTransaction: vi.fn() as never,
      };

      const facilitator = toFacilitatorSuiSigner(input);
      const addresses = facilitator.getAddresses();

      expect(addresses).toHaveLength(1);
      expect(addresses[0]).toBe("0xabc123");
    });

    it("should pass through the signTransaction call", async () => {
      const signMock = vi.fn().mockResolvedValue("signed");
      const input = {
        address: "0xdef456" as `0x${string}`,
        signTransaction: signMock as never,
      };

      const facilitator = toFacilitatorSuiSigner(input);
      const result = await facilitator.signTransaction("tx==");

      expect(result).toBe("signed");
      expect(signMock).toHaveBeenCalledWith("tx==");
    });

    it("should produce a FacilitatorSuiSigner-compatible signer", () => {
      const input = {
        address: "0xfacilitator" as `0x${string}`,
        signTransaction: vi.fn() as never,
      };

      const facilitator: FacilitatorSuiSigner = toFacilitatorSuiSigner(input);
      expect(facilitator.getAddresses()).toEqual(["0xfacilitator"]);
    });
  });
});
