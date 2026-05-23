import { SuiGrpcClient } from "@mysten/sui/grpc";

import type { SuiNetwork } from "./types";
import {
  SUI_DEVNET_CAIP2,
  SUI_DEVNET_GRPC_URL,
  SUI_MAINNET_CAIP2,
  SUI_MAINNET_GRPC_URL,
  SUI_TESTNET_CAIP2,
  SUI_TESTNET_GRPC_URL,
} from "./constants";

export interface SuiClientRegistry {
  set(network: SuiNetwork, client: SuiGrpcClient): void;
  get(network: SuiNetwork): SuiGrpcClient;
}

export const createSuiClientRegistry = (): SuiClientRegistry => {
  const clients: Record<SuiNetwork, SuiGrpcClient> = {
    [SUI_MAINNET_CAIP2]: new SuiGrpcClient({
      network: "mainnet",
      baseUrl: SUI_MAINNET_GRPC_URL,
    }),
    [SUI_TESTNET_CAIP2]: new SuiGrpcClient({
      network: "testnet",
      baseUrl: SUI_TESTNET_GRPC_URL,
    }),
    [SUI_DEVNET_CAIP2]: new SuiGrpcClient({
      network: "devnet",
      baseUrl: SUI_DEVNET_GRPC_URL,
    }),
  };

  return {
    set(network: SuiNetwork, client: SuiGrpcClient): void {
      clients[network] = client;
    },
    get(network: SuiNetwork): SuiGrpcClient {
      return clients[network];
    },
  };
};
