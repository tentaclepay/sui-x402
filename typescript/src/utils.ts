import type { Network } from "@x402/core/types";

import type { SuiNetwork } from "./types";
import {
  SUI_MAINNET_CAIP2,
  SUI_NETWORK_CAIP2_LIST,
  SUI_TESTNET_CAIP2,
  USDC_MAINNET_COIN_TYPE,
  USDC_TESTNET_COIN_TYPE,
} from "./constants";

/**
 * Get the default USDC CoinType for a network
 *
 * @param network - Network identifier (CAIP-2 or V1 format)
 * @returns USDC CoinType for the network
 */
export function getUsdcCoinType(network: Network): string {
  switch (network) {
    case SUI_MAINNET_CAIP2:
      return USDC_MAINNET_COIN_TYPE;
    case SUI_TESTNET_CAIP2:
      return USDC_TESTNET_COIN_TYPE;
    default:
      throw new Error(`No USDC CoinType configured for network: ${network}`);
  }
}

export function isValidNetwork(
  network: Network | string
): network is SuiNetwork {
  return SUI_NETWORK_CAIP2_LIST.includes(network as SuiNetwork);
}
