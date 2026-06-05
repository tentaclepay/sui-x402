/**
 * Default gRPC URLs for Sui networks
 */
export const SUI_MAINNET_GRPC_URL =
  "https://fullnode.mainnet.sui.io:443" as const;
export const SUI_TESTNET_GRPC_URL =
  "https://fullnode.testnet.sui.io:443" as const;
export const SUI_DEVNET_GRPC_URL =
  "https://fullnode.devnet.sui.io:443" as const;

/**
 * Mainnet token CoinType
 */
export const USDC_MAINNET_COIN_TYPE =
  "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC" as const; // Default stablecoin
export const USDSUI_MAINNET_COIN_TYPE =
  "0x44f838219cf67b058f3b37907b655f226153c18e33dfcd0da559a844fea9b1c1::usdsui::USDSUI" as const;
export const SUI_USDE_MAINNET_COIN_TYPE =
  "0x41d587e5336f1c86cad50d38a7136db99333bb9bda91cea4ba69115defeb1402::sui_usde::SUI_USDE" as const;
export const USDY_MAINNET_COIN_TYPE =
  "0x960b531667636f39e85867775f52f6b1f220a058c4de786905bdf761e06a56bb::usdy::USDY" as const;
export const FDUSD_MAINNET_COIN_TYPE =
  "0xf16e6b723f242ec745dfd7634ad072c42d5c1d9ac9d62a39c381303eaa57693a::fdusd::FDUSD" as const;
export const AUSD_MAINNET_COIN_TYPE =
  "0x2053d08c1e2bd02791056171aab0fd12bd7cd7efad2ab8f6b9c8902f14df2ff2::ausd::AUSD" as const;
export const USDB_MAINNET_COIN_TYPE =
  "0xe14726c336e81b32328e92afc37345d159f5b550b09fa92bd43640cfdd0a0cfd::usdb::USDB" as const;

/**
 * Testnet token CoinType
 */
export const USDC_TESTNET_COIN_TYPE =
  "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC" as const; // Default stablecoin

/**
 * Gasless token lists
 */
export const MAINNET_GASLESS_TOKEN_RULES = {
  [USDC_MAINNET_COIN_TYPE]: {
    minAmount: 10_000n,
  },
  [USDSUI_MAINNET_COIN_TYPE]: {
    minAmount: 10_000n,
  },
  [SUI_USDE_MAINNET_COIN_TYPE]: {
    minAmount: 10_000n,
  },
  [USDY_MAINNET_COIN_TYPE]: {
    minAmount: 10_000n,
  },
  [FDUSD_MAINNET_COIN_TYPE]: {
    minAmount: 10_000n,
  },
  [AUSD_MAINNET_COIN_TYPE]: {
    minAmount: 10_000n,
  },
  [USDB_MAINNET_COIN_TYPE]: {
    minAmount: 10_000n,
  },
} as const;
export const TESTNET_GASLESS_TOKEN_RULES = {
  [USDC_TESTNET_COIN_TYPE]: {
    minAmount: 0n,
  },
} as const;

/**
 * Token decimals
 */
export const USDC_DECIMAL = 6 as const;
export const USDSUI_DECIMAL = 6 as const;
export const SUI_USDE_DECIMAL = 6 as const;
export const USDY_DECIMAL = 6 as const;
export const FDUSD_DECIMAL = 6 as const;
export const AUSD_DECIMAL = 6 as const;
export const USDB_DECIMAL = 6 as const;

/**
 * CAIP-2 network identifiers for Sui (V2)
 */
export const SUI_MAINNET_CAIP2 = "sui:mainnet" as const;
export const SUI_TESTNET_CAIP2 = "sui:testnet" as const;
export const SUI_DEVNET_CAIP2 = "sui:devnet" as const;
export const SUI_NETWORK_CAIP2_LIST = [
  SUI_MAINNET_CAIP2,
  SUI_TESTNET_CAIP2,
  SUI_DEVNET_CAIP2,
] as const;

/**
 * Facilitator gas budget for gas sponsoring transactions
 */
export const DEFAULT_GAS_BUDGET = 2_000_000n;
