import type { SuiAddress } from "./types";

export type ClientSuiSigner = {
  readonly address: SuiAddress;
  signTransaction(bytes: string): Promise<string>;
};

export type FacilitatorSuiSigner = {
  getAddresses(): readonly SuiAddress[];
  signTransaction(bytes: string): Promise<string>;
};

export function toFacilitatorSuiSigner(
  signer: Omit<FacilitatorSuiSigner, "getAddresses"> & {
    address: SuiAddress;
  }
): FacilitatorSuiSigner {
  return {
    ...signer,
    getAddresses: () => [signer.address],
  };
}
