import type { SUI_NETWORK_CAIP2_LIST } from "./constants";

export type SuiNetwork = (typeof SUI_NETWORK_CAIP2_LIST)[number];

export type SuiAddress = `0x${string}`;

export type ExactSuiPayload = {
  transaction: string;
  signature: string;
};
