import type { SuiAddress } from "./types";
import { DEFAULT_GAS_BUDGET } from "./constants";

export type ClientSuiSigner = {
  readonly address: SuiAddress;
  signTransaction(bytes: string): Promise<string>;
};

export type FacilitatorSuiSigner = {
  getAddresses(): readonly SuiAddress[];
  getGasBudget(): bigint;
  signTransaction(bytes: string): Promise<string>;
};

export function toFacilitatorSuiSigner(
  signer: Omit<FacilitatorSuiSigner, "getAddresses" | "getGasBudget"> & {
    address: SuiAddress;
  },
  gasBudget: string | number | bigint = DEFAULT_GAS_BUDGET
): FacilitatorSuiSigner {
  return {
    ...signer,
    getAddresses: () => [signer.address],
    getGasBudget: () => BigInt(gasBudget),
  };
}
