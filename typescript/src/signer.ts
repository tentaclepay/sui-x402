import type { SuiAddress } from "./types";
import { DEFAULT_GAS_BUDGET } from "./constants";

export type ClientSuiSigner = {
  readonly address: SuiAddress;
  signTransaction(bytes: string): Promise<string>;
};

export type FacilitatorSuiSigner = {
  getAddresses(): readonly SuiAddress[];
  getGasBudget(): string;
  signTransaction(bytes: string): Promise<string>;
};

export function toFacilitatorSuiSigner(
  signer: Omit<FacilitatorSuiSigner, "getAddresses" | "getGasBudget"> & {
    address: SuiAddress;
    gasBudget?: string | number | bigint;
  }
): FacilitatorSuiSigner {
  return {
    ...signer,
    getAddresses: () => [signer.address],
    getGasBudget: () =>
      BigInt(signer.gasBudget ?? DEFAULT_GAS_BUDGET).toString(),
  };
}
