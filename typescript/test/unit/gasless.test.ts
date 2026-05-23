import type { PaymentRequirements } from "@x402/core/types";
import { Transaction } from "@mysten/sui/transactions";
import { describe, expect, it } from "vitest";

import { SUI_MAINNET_CAIP2, USDC_MAINNET_COIN_TYPE } from "../../src/constants";
import {
  isGaslessTransaction,
  validateGaslessTransaction,
} from "../../src/exact/facilitator/gasless";

const SENDER =
  "0x0000000000000000000000000000000000000000000000000000000000000099";
const PAY_TO =
  "0x0000000000000000000000000000000000000000000000000000000000000001";

// Build a transaction with the gas data shape produced by the client scheme
// after CoinWithBalance resolution: a FundsWithdrawal input + `redeem_funds`
// MoveCall that yields the balance fed into `send_funds`.
// Using `tx.withdrawal()` lets us build offline without a real SuiClient.
function buildGaslessSendFundsTransaction(
  asset: string,
  amount: bigint,
  payTo: string
): Transaction {
  const tx = new Transaction();
  tx.setSender(SENDER);
  // Mark the transaction as gasless and ensure `build()` does not need a client
  // to fetch gas data.
  tx.setGasPrice(0);
  tx.setGasBudget(0);
  tx.setGasPayment([]);
  tx.setExpiration({ Epoch: 0 });

  const withdrawal = tx.withdrawal({ amount, type: asset });

  const [balance] = tx.moveCall({
    target: "0x2::balance::redeem_funds",
    typeArguments: [asset],
    arguments: [withdrawal],
  });

  tx.moveCall({
    target: "0x2::balance::send_funds",
    typeArguments: [asset],
    arguments: [balance, tx.pure.address(payTo)],
  });

  return tx;
}

describe("isGaslessTransaction", () => {
  it("should return true for a transaction with zeroed gas data and no payment", () => {
    const tx = buildGaslessSendFundsTransaction(
      USDC_MAINNET_COIN_TYPE,
      1_000_000n,
      PAY_TO
    );
    const data = tx.getData();

    expect(isGaslessTransaction(data)).toBe(true);
  });

  it("should return false when gas budget is set to non-zero", () => {
    const tx = buildGaslessSendFundsTransaction(
      USDC_MAINNET_COIN_TYPE,
      1_000_000n,
      PAY_TO
    );
    const data = tx.getData();
    const tampered = {
      ...data,
      gasData: { ...data.gasData, budget: "1000" },
    };

    expect(isGaslessTransaction(tampered)).toBe(false);
  });

  it("should return false when gas price is set to non-zero", () => {
    const tx = buildGaslessSendFundsTransaction(
      USDC_MAINNET_COIN_TYPE,
      1_000_000n,
      PAY_TO
    );
    const data = tx.getData();
    const tampered = {
      ...data,
      gasData: { ...data.gasData, price: "1000" },
    };

    expect(isGaslessTransaction(tampered)).toBe(false);
  });

  it("should return false when gas payment is non-empty", () => {
    const tx = buildGaslessSendFundsTransaction(
      USDC_MAINNET_COIN_TYPE,
      1_000_000n,
      PAY_TO
    );
    const data = tx.getData();
    const tampered = {
      ...data,
      gasData: {
        ...data.gasData,
        payment: [
          {
            objectId: "0x0",
            version: "1",
            digest: "11111111111111111111111111111111",
          },
        ],
      },
    };

    expect(isGaslessTransaction(tampered)).toBe(false);
  });

  it("should return false when gas owner differs from sender", () => {
    const tx = buildGaslessSendFundsTransaction(
      USDC_MAINNET_COIN_TYPE,
      1_000_000n,
      PAY_TO
    );
    const data = tx.getData();
    const tampered = {
      ...data,
      gasData: { ...data.gasData, owner: PAY_TO },
    };

    expect(isGaslessTransaction(tampered)).toBe(false);
  });
});

describe("validateGaslessTransaction", () => {
  const baseRequirements: PaymentRequirements = {
    scheme: "exact",
    network: SUI_MAINNET_CAIP2,
    asset: USDC_MAINNET_COIN_TYPE,
    amount: "1000000",
    payTo: PAY_TO,
    maxTimeoutSeconds: 3600,
    extra: {},
  };

  it("should validate a correctly-built send_funds transaction", async () => {
    const tx = buildGaslessSendFundsTransaction(
      USDC_MAINNET_COIN_TYPE,
      1_000_000n,
      PAY_TO
    );
    const bytes = await tx.build();

    expect(validateGaslessTransaction(bytes, baseRequirements)).toBe(true);
  });

  it("should reject when the amount does not match requirements", async () => {
    const tx = buildGaslessSendFundsTransaction(
      USDC_MAINNET_COIN_TYPE,
      999n,
      PAY_TO
    );
    const bytes = await tx.build();

    expect(validateGaslessTransaction(bytes, baseRequirements)).toBe(false);
  });

  it("should reject when the recipient does not match requirements", async () => {
    const tx = buildGaslessSendFundsTransaction(
      USDC_MAINNET_COIN_TYPE,
      1_000_000n,
      "0x0000000000000000000000000000000000000000000000000000000000000002"
    );
    const bytes = await tx.build();

    expect(validateGaslessTransaction(bytes, baseRequirements)).toBe(false);
  });

  it("should reject when the asset type does not match requirements", async () => {
    const tx = buildGaslessSendFundsTransaction(
      "0x0000000000000000000000000000000000000000000000000000000000000abc::usdt::USDT",
      1_000_000n,
      PAY_TO
    );
    const bytes = await tx.build();

    expect(validateGaslessTransaction(bytes, baseRequirements)).toBe(false);
  });

  it("should reject a transaction missing the send_funds command", async () => {
    const tx = new Transaction();
    tx.setSender(SENDER);
    tx.setGasPrice(0);
    tx.setGasBudget(0);
    tx.setGasPayment([]);
    tx.setExpiration({ Epoch: 0 });

    const bytes = await tx.build();

    expect(validateGaslessTransaction(bytes, baseRequirements)).toBe(false);
  });

  it("should reject a transaction calling send_funds on a non-framework package", async () => {
    const tx = new Transaction();
    tx.setSender(SENDER);
    tx.setGasPrice(0);
    tx.setGasBudget(0);
    tx.setGasPayment([]);
    tx.setExpiration({ Epoch: 0 });

    const withdrawal = tx.withdrawal({
      amount: 1_000_000n,
      type: USDC_MAINNET_COIN_TYPE,
    });
    const [balance] = tx.moveCall({
      target: "0x2::balance::redeem_funds",
      typeArguments: [USDC_MAINNET_COIN_TYPE],
      arguments: [withdrawal],
    });
    tx.moveCall({
      // Not under the framework (0x2)
      target:
        "0x0000000000000000000000000000000000000000000000000000000000000abc::balance::send_funds",
      typeArguments: [USDC_MAINNET_COIN_TYPE],
      arguments: [balance, tx.pure.address(PAY_TO)],
    });

    const bytes = await tx.build();

    expect(validateGaslessTransaction(bytes, baseRequirements)).toBe(false);
  });
});
