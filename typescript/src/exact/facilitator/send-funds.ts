import type { Argument, CallArg, Command } from "@mysten/sui/transactions";
import type { PaymentRequirements } from "@x402/core/types";
import { Transaction } from "@mysten/sui/transactions";
import {
  fromBase64,
  normalizeStructTag,
  normalizeSuiAddress,
} from "@mysten/sui/utils";

import type { SuiAddress } from "../../types";

const SUI_FRAMEWORK = normalizeSuiAddress("0x2");

type SuiCommands = Command[];
type SuiInputs = CallArg[];
type MoveCallCommand = Extract<Command, { $kind: "MoveCall" }>["MoveCall"];

export function validateSendFundsTransaction(
  transactionBytes: Uint8Array,
  requirements: PaymentRequirements
): boolean {
  const transaction = Transaction.from(transactionBytes);
  const transactionData = transaction.getData();

  const expectedAsset = normalizeStructTag(requirements.asset);
  const expectedPayTo = normalizeSuiAddress(requirements.payTo);
  const expectedAmount = BigInt(requirements.amount);

  if (
    !transactionData.gasData.owner ||
    !transactionData.gasData.payment ||
    transactionData.gasData.payment.length !== 0
  )
    return false;

  const sponsor = requirements.extra?.gasOwner as SuiAddress;
  if (!sponsor) return false;

  const gasBudget = requirements.extra?.gasBudget as bigint;
  if (
    !gasBudget ||
    !transactionData.gasData.budget ||
    BigInt(transactionData.gasData.budget) > BigInt(gasBudget)
  )
    return false;

  const isValidGasOwner =
    normalizeSuiAddress(transactionData.gasData.owner) ===
    normalizeSuiAddress(sponsor);
  if (!isValidGasOwner) return false;

  const sendFunds = findSendFundsCommand(transactionData.commands);
  if (!sendFunds) return false;

  const [typeArg] = sendFunds.typeArguments;
  if (!typeArg || normalizeStructTag(typeArg) !== expectedAsset) return false;

  const [balanceArg, payToArg] = sendFunds.arguments;
  if (!balanceArg || !payToArg) return false;

  if (payToArg.$kind !== "Input") return false;
  const payToInput = transactionData.inputs[payToArg.Input];
  if (!payToInput || payToInput.$kind !== "Pure") return false;
  const payToAddress = decodePureAddress(payToInput.Pure.bytes);
  if (!payToAddress) return false;
  if (normalizeSuiAddress(payToAddress) !== expectedPayTo) return false;

  const amount = resolveBalanceAmount(
    balanceArg,
    transactionData.commands,
    transactionData.inputs
  );
  if (amount === null || amount !== expectedAmount) return false;

  return true;
}

function findSendFundsCommand(commands: SuiCommands): MoveCallCommand | null {
  let found: MoveCallCommand | null = null;
  for (const cmd of commands) {
    if (cmd.$kind !== "MoveCall") continue;
    const { package: pkg, module, function: fn } = cmd.MoveCall;
    if (
      normalizeSuiAddress(pkg) === SUI_FRAMEWORK &&
      module === "balance" &&
      fn === "send_funds"
    ) {
      if (found) return null;
      found = cmd.MoveCall;
    }
  }
  return found;
}

function resolveBalanceAmount(
  arg: Argument,
  commands: SuiCommands,
  inputs: SuiInputs
): bigint | null {
  if (arg.$kind === "Input") {
    const input = inputs[arg.Input];
    if (!input || input.$kind !== "FundsWithdrawal") return null;
    return BigInt(input.FundsWithdrawal.reservation.MaxAmountU64);
  }

  const cmd = resolveResultCommand(arg, commands);
  if (!cmd || cmd.$kind !== "MoveCall") return null;

  const { package: pkg, module, function: fn, arguments: args } = cmd.MoveCall;
  if (normalizeSuiAddress(pkg) !== SUI_FRAMEWORK) return null;

  if (module === "balance" && fn === "redeem_funds") {
    const [withdrawArg] = args;
    if (!withdrawArg || withdrawArg.$kind !== "Input") return null;
    const input = inputs[withdrawArg.Input];
    if (!input || input.$kind !== "FundsWithdrawal") return null;
    return BigInt(input.FundsWithdrawal.reservation.MaxAmountU64);
  }

  if (module === "coin" && fn === "into_balance") {
    const [coinArg] = args;
    if (!coinArg) return null;
    return resolveCoinAmount(coinArg, commands, inputs);
  }

  return null;
}

function resolveCoinAmount(
  arg: Argument,
  commands: SuiCommands,
  inputs: SuiInputs
): bigint | null {
  const cmd = resolveResultCommand(arg, commands);
  if (!cmd || cmd.$kind !== "SplitCoins") return null;

  const [amountArg] = cmd.SplitCoins.amounts;
  if (!amountArg || amountArg.$kind !== "Input") return null;
  const input = inputs[amountArg.Input];
  if (!input || input.$kind !== "Pure") return null;
  return decodePureU64(input.Pure.bytes);
}

function resolveResultCommand(
  arg: Argument,
  commands: SuiCommands
): SuiCommands[number] | null {
  if (arg.$kind === "NestedResult") {
    if (arg.NestedResult[1] !== 0) return null;
    return commands[arg.NestedResult[0]] ?? null;
  }
  if (arg.$kind === "Result") {
    return commands[arg.Result] ?? null;
  }
  return null;
}

function decodePureAddress(base64Bytes: string): string | null {
  try {
    const bytes = fromBase64(base64Bytes);
    if (bytes.length !== 32) return null;
    let hex = "0x";
    for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
    return hex;
  } catch {
    return null;
  }
}

function decodePureU64(base64Bytes: string): bigint | null {
  try {
    const bytes = fromBase64(base64Bytes);
    if (bytes.length !== 8) return null;
    let value = 0n;
    for (let i = 7; i >= 0; i--) value = (value << 8n) | BigInt(bytes[i]);
    return value;
  } catch {
    return null;
  }
}
