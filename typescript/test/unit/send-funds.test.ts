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
function buildSendFundsTransaction(
  asset: string,
  amount: bigint,
  payTo: string,
  gasOwner: string = GAS_OWNER
): Transaction {
  const tx = new Transaction();
  tx.setSender(SENDER);
  tx.setGasOwner(gasOwner);
  tx.setGasPayment([]);
  tx.setGasPrice(1000);
  tx.setGasBudget(10_000_000);
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
    extra: { gasOwner: GAS_OWNER },
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
    tx.setGasPrice(1000);
    tx.setGasBudget(10_000_000);
    tx.setExpiration({ Epoch: 0 });

    const bytes = await tx.build();

    expect(validateSendFundsTransaction(bytes, baseRequirements)).toBe(false);
  });

  it("should reject a transaction calling send_funds on a non-framework package", async () => {
    const tx = new Transaction();
    tx.setSender(SENDER);
    tx.setGasOwner(GAS_OWNER);
    tx.setGasPayment([]);
    tx.setGasPrice(1000);
    tx.setGasBudget(10_000_000);
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
