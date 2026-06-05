import type { PaymentRequirements } from "@x402/core/schemas";
import type {
  PaymentPayloadResult,
  SchemeNetworkClient,
} from "@x402/core/types";
import { Transaction } from "@mysten/sui/transactions";
import { isValidSuiAddress, toBase64 } from "@mysten/sui/utils";
import { PaymentRequirementsV2Schema } from "@x402/core/schemas";

import type { SuiClientRegistry } from "../../client-registry";
import type { ClientSuiSigner } from "../../signer";
import type { ExactSuiPayload, SuiAddress } from "../../types";
import { createSuiClientRegistry } from "../../client-registry";
import { isValidNetwork } from "../../utils";

export type ExactSuiSchemeOptions = {
  clientRegistry?: SuiClientRegistry;
};

/**
 * Sui client implementation for the Exact payment scheme.
 */
export class ExactSuiScheme implements SchemeNetworkClient {
  readonly scheme = "exact";

  private readonly clientRegistry: SuiClientRegistry;

  /**
   * Creates a new ExactSuiClient instance.
   *
   * @param signer - The Sui signer for client operations
   * @returns ExactSuiClient instance
   */
  constructor(
    private readonly signer: ClientSuiSigner,
    readonly options?: ExactSuiSchemeOptions
  ) {
    this.clientRegistry = options?.clientRegistry ?? createSuiClientRegistry();
  }

  /**
   * Creates a payment payload for the Exact scheme.
   *
   * @param x402Version - The x402 protocol version
   * @param paymentRequirements - The payment requirements
   * @returns Promise resolving to a payment payload
   */
  async createPaymentPayload(
    x402Version: number,
    paymentRequirements: PaymentRequirements
  ): Promise<PaymentPayloadResult> {
    if (x402Version !== 2) throw new Error("Only V2 schema is supported");

    const paymentRequirementsResult =
      PaymentRequirementsV2Schema.safeParse(paymentRequirements);
    if (!paymentRequirementsResult.success)
      throw new Error(
        "Invalid payment requirements, only V2 schema is supported"
      );

    const { network, asset, amount, payTo } = paymentRequirementsResult.data;
    if (!isValidNetwork(network))
      throw new Error("Invalid network, must be a valid Sui network");

    const isValidPayTo = isValidSuiAddress(payTo);
    if (!isValidPayTo)
      throw new Error("Invalid recipient address, must be a valid Sui address");

    const client = this.clientRegistry.get(network);

    const gasOwner = paymentRequirements.extra?.gasOwner as SuiAddress;
    if (!gasOwner) {
      throw new Error(
        "gasOwner is required in paymentRequirements.extra for Sui transactions"
      );
    }

    const gasBudget = paymentRequirements.extra?.gasBudget as string;
    if (!gasBudget) {
      throw new Error(
        "gasBudget is required in paymentRequirements.extra for Sui transactions"
      );
    }

    const transaction = new Transaction();

    const resolvedAmount = BigInt(amount);

    transaction.setSender(this.signer.address);
    transaction.moveCall({
      target: "0x2::balance::send_funds",
      typeArguments: [asset],
      arguments: [
        transaction.balance({
          type: asset,
          balance: resolvedAmount,
          useGasCoin: false,
        }),
        transaction.pure.address(payTo),
      ],
    });
    transaction.setGasBudget(gasBudget);
    transaction.setGasOwner(gasOwner);
    transaction.setGasPayment([]);

    const transactionBytes = await transaction.build({
      client,
    });
    const transactionBase64 = toBase64(transactionBytes);

    const signature = await this.signer.signTransaction(transactionBase64);

    const payload: ExactSuiPayload = {
      transaction: transactionBase64,
      signature,
    };

    return {
      x402Version,
      payload,
    };
  }
}
