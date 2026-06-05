import type { PaymentRequirements } from "@x402/core/types";
import { Transaction } from "@mysten/sui/transactions";
import { describe, expect, it } from "vitest";

import { SUI_MAINNET_CAIP2, USDC_MAINNET_COIN_TYPE } from "../../src/constants";
import { validateSendFundsTransaction } from "../../src/exact/facilitator/send-funds";

const SENDER =
  "0x0000000000000000000000000000000000000000000000000000000000000099";
const PAY_TO =
  "0x0000000000000000000000000000000000000000000000000000000000000001";
const GAS_OWNER =
  "0x00000000000000000000000000000000000000000000000000000000000000aa";

// Build a transaction with the gas data shape produced by the client scheme
// after CoinWithBalance resolution: a FundsWithdrawal input + `redeem_funds`
// MoveCall that yields the balance fed into `send_funds`. Gas is sponsored by
// `gasOwner` (separate from the sender) with no gas payment objects attached
// — the facilitator fills those in later. Using `tx.withdrawal()` lets us
// build offline without a real SuiClient.
//
// Defaults mirror the gasless path the client scheme produces for gasless
// tokens (USDC mainnet at amounts >= minAmount): both the gas budget and gas
// price are 0. Pass an explicit `gasBudget`/`gasPrice` to build a sponsored
// (non-gasless) transaction.
function buildSendFundsTransaction(
  asset: string,
  amount: bigint,
  payTo: string,
  gasOwner: string = GAS_OWNER,
  gasBudget: number | bigint = 0n,
  gasPrice: number | bigint = 0n
): Transaction {
  const tx = new Transaction();
  tx.setSender(SENDER);
  tx.setGasOwner(gasOwner);
  tx.setGasPayment([]);
  tx.setGasPrice(gasPrice);
  tx.setGasBudget(gasBudget);
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

describe("validateSendFundsTransaction", () => {
  const baseRequirements: PaymentRequirements = {
    scheme: "exact",
    network: SUI_MAINNET_CAIP2,
    asset: USDC_MAINNET_COIN_TYPE,
    amount: "1000000",
    payTo: PAY_TO,
    maxTimeoutSeconds: 3600,
    // USDC mainnet at 1_000_000 is gasless, so the helper's default gas data
    // (budget 0, price 0) matches; gasBudget here only applies to the
    // non-gasless path exercised by some cases below.
    extra: { gasOwner: GAS_OWNER, gasBudget: 10_000_000n },
  };

  it("should validate a correctly-built send_funds transaction", async () => {
    const tx = buildSendFundsTransaction(
      USDC_MAINNET_COIN_TYPE,
      1_000_000n,
      PAY_TO
    );
    const bytes = await tx.build();

    expect(validateSendFundsTransaction(bytes, baseRequirements)).toBe(true);
  });

  it("should reject when the amount does not match requirements", async () => {
    const tx = buildSendFundsTransaction(USDC_MAINNET_COIN_TYPE, 999n, PAY_TO);
    const bytes = await tx.build();

    expect(validateSendFundsTransaction(bytes, baseRequirements)).toBe(false);
  });

  it("should reject when the recipient does not match requirements", async () => {
    const tx = buildSendFundsTransaction(
      USDC_MAINNET_COIN_TYPE,
      1_000_000n,
      "0x0000000000000000000000000000000000000000000000000000000000000002"
    );
    const bytes = await tx.build();

    expect(validateSendFundsTransaction(bytes, baseRequirements)).toBe(false);
  });

  it("should reject when the asset type does not match requirements", async () => {
    const tx = buildSendFundsTransaction(
      "0x0000000000000000000000000000000000000000000000000000000000000abc::usdt::USDT",
      1_000_000n,
      PAY_TO
    );
    const bytes = await tx.build();

    expect(validateSendFundsTransaction(bytes, baseRequirements)).toBe(false);
  });

  it("should reject when gasOwner is missing from requirements.extra", async () => {
    const tx = buildSendFundsTransaction(
      USDC_MAINNET_COIN_TYPE,
      1_000_000n,
      PAY_TO
    );
    const bytes = await tx.build();
    const requirementsWithoutSponsor: PaymentRequirements = {
      ...baseRequirements,
      extra: {},
    };

    expect(
      validateSendFundsTransaction(bytes, requirementsWithoutSponsor)
    ).toBe(false);
  });

  it("should reject when the transaction gas owner does not match the sponsor in extra", async () => {
    const tx = buildSendFundsTransaction(
      USDC_MAINNET_COIN_TYPE,
      1_000_000n,
      PAY_TO,
      "0x00000000000000000000000000000000000000000000000000000000000000bb"
    );
    const bytes = await tx.build();

    expect(validateSendFundsTransaction(bytes, baseRequirements)).toBe(false);
  });

  it("should reject when the transaction has gas payment objects attached", async () => {
    const tx = buildSendFundsTransaction(
      USDC_MAINNET_COIN_TYPE,
      1_000_000n,
      PAY_TO
    );
    tx.setGasPayment([
      {
        objectId: "0x0",
        version: "1",
        digest: "11111111111111111111111111111111",
      },
    ]);
    const bytes = await tx.build();

    expect(validateSendFundsTransaction(bytes, baseRequirements)).toBe(false);
  });

  it("should reject a transaction missing the send_funds command", async () => {
    const tx = new Transaction();
    tx.setSender(SENDER);
    tx.setGasOwner(GAS_OWNER);
    tx.setGasPayment([]);
    // Gasless gas data so validation reaches the missing-command check.
    tx.setGasPrice(0n);
    tx.setGasBudget(0n);
    tx.setExpiration({ Epoch: 0 });

    const bytes = await tx.build();

    expect(validateSendFundsTransaction(bytes, baseRequirements)).toBe(false);
  });

  describe("gas budget validation (non-gasless)", () => {
    // USDC mainnet below the gasless minAmount (10_000n) takes the sponsored
    // path, where the tx gas budget must exactly match the budget the
    // facilitator advertised in requirements.extra.
    const NON_GASLESS_AMOUNT = 5_000n;
    const GAS_BUDGET = 10_000_000n;
    const requirementsWithBudget: PaymentRequirements = {
      ...baseRequirements,
      amount: NON_GASLESS_AMOUNT.toString(),
      extra: { gasOwner: GAS_OWNER, gasBudget: GAS_BUDGET },
    };

    it("should validate when the transaction gas budget equals the allowed budget", async () => {
      const tx = buildSendFundsTransaction(
        USDC_MAINNET_COIN_TYPE,
        NON_GASLESS_AMOUNT,
        PAY_TO,
        GAS_OWNER,
        GAS_BUDGET
      );
      const bytes = await tx.build();

      expect(validateSendFundsTransaction(bytes, requirementsWithBudget)).toBe(
        true
      );
    });

    it("should reject when the transaction gas budget is below the allowed budget", async () => {
      const tx = buildSendFundsTransaction(
        USDC_MAINNET_COIN_TYPE,
        NON_GASLESS_AMOUNT,
        PAY_TO,
        GAS_OWNER,
        5_000_000n
      );
      const bytes = await tx.build();

      expect(validateSendFundsTransaction(bytes, requirementsWithBudget)).toBe(
        false
      );
    });

    it("should reject when the transaction gas budget exceeds the allowed budget", async () => {
      const tx = buildSendFundsTransaction(
        USDC_MAINNET_COIN_TYPE,
        NON_GASLESS_AMOUNT,
        PAY_TO,
        GAS_OWNER,
        50_000_000n
      );
      const bytes = await tx.build();

      expect(validateSendFundsTransaction(bytes, requirementsWithBudget)).toBe(
        false
      );
    });

    it("should reject when gasBudget is missing from requirements.extra", async () => {
      const tx = buildSendFundsTransaction(
        USDC_MAINNET_COIN_TYPE,
        NON_GASLESS_AMOUNT,
        PAY_TO,
        GAS_OWNER,
        GAS_BUDGET
      );
      const bytes = await tx.build();
      const requirementsWithoutBudget: PaymentRequirements = {
        ...requirementsWithBudget,
        extra: { gasOwner: GAS_OWNER },
      };

      expect(
        validateSendFundsTransaction(bytes, requirementsWithoutBudget)
      ).toBe(false);
    });
  });

  it("should reject a transaction calling send_funds on a non-framework package", async () => {
    const tx = new Transaction();
    tx.setSender(SENDER);
    tx.setGasOwner(GAS_OWNER);
    tx.setGasPayment([]);
    // Gasless gas data so validation reaches the send_funds package check.
    tx.setGasPrice(0n);
    tx.setGasBudget(0n);
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

    expect(validateSendFundsTransaction(bytes, baseRequirements)).toBe(false);
  });
});
