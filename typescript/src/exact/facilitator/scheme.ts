import type {
  PaymentPayload,
  PaymentRequirements,
  SchemeNetworkFacilitator,
  SettleResponse,
  VerifyResponse,
} from "@x402/core/types";
import { fromBase64, normalizeSuiAddress } from "@mysten/sui/utils";

import type { SuiClientRegistry } from "../../client-registry";
import type { FacilitatorSuiSigner } from "../../signer";
import type { ExactSuiPayload, SuiNetwork } from "../../types";
import { createSuiClientRegistry } from "../../client-registry";
import { isValidNetwork } from "../../utils";
import { validateSendFundsTransaction } from "./send-funds";

export type ExactSuiSchemeOptions = {
  clientRegistry?: SuiClientRegistry;
};

/**
 * Sui facilitator implementation for the Exact payment scheme.
 */
export class ExactSuiScheme implements SchemeNetworkFacilitator {
  readonly scheme = "exact";
  readonly caipFamily = "sui:*";

  private readonly clientRegistry: SuiClientRegistry;

  /**
   * Creates a new ExactSuiFacilitator instance.
   *
   * @param signer - The Sui RPC client for facilitator operations
   * @returns ExactSuiFacilitator instance
   */
  constructor(
    private readonly signer: FacilitatorSuiSigner,
    readonly options?: ExactSuiSchemeOptions
  ) {
    this.clientRegistry = options?.clientRegistry ?? createSuiClientRegistry();
  }

  /**
   * Get mechanism-specific extra data for the supported kinds endpoint.
   * For Sui, this includes a randomly selected gas owner address.
   * Random selection distributes load across multiple signers.
   *
   * @param _ - The network identifier (unused for Sui)
   * @returns Extra data with gasOwner address
   */
  getExtra(_: string): Record<string, unknown> | undefined {
    const addresses = this.signer.getAddresses();
    const randomIndex = Math.floor(Math.random() * addresses.length);

    return {
      gasOwner: addresses[randomIndex],
      gasBudget: this.signer.getGasBudget(),
    };
  }

  /**
   * Get signer addresses used by this facilitator.
   *
   * @param _ - The network identifier (unused for Sui)
   * @returns Array of facilitator addresses
   */
  getSigners(_: string): string[] {
    return [...this.signer.getAddresses()];
  }

  /**
   * Verifies a payment payload: structural validation of the Sui PTB,
   * client signature, and on-chain simulation.
   *
   * @param payload - The payment payload to verify
   * @param requirements - The payment requirements
   * @returns Promise resolving to verification response
   */
  async verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<VerifyResponse> {
    if (payload.accepted.scheme !== requirements.scheme)
      return { isValid: false, invalidReason: "scheme_mismatch" };

    if (
      payload.accepted.network !== requirements.network &&
      !isValidNetwork(payload.accepted.network)
    )
      return { isValid: false, invalidReason: "network_mismatch" };

    const network = payload.accepted.network as SuiNetwork;

    const exactSuiPayload = payload.payload as ExactSuiPayload;

    const transaction = fromBase64(exactSuiPayload.transaction);

    if (!validateSendFundsTransaction(transaction, requirements))
      return { isValid: false, invalidReason: "invalid_transaction" };

    const client = this.clientRegistry.get(network);

    const simulation = await client.simulateTransaction({
      transaction,
      include: {
        transaction: true,
      },
    });

    if (simulation.$kind === "FailedTransaction")
      return {
        isValid: false,
        invalidReason: "invalid_transaction",
        invalidMessage:
          simulation.FailedTransaction.status.error?.message ??
          "simulation failed",
      };

    return {
      isValid: true,
      payer: simulation.Transaction.transaction.sender
        ? normalizeSuiAddress(simulation.Transaction.transaction.sender)
        : "",
    };
  }

  /**
   * Settles a payment by broadcasting the client-signed transaction.
   * The transaction pays its own gas via `0x2::balance::send_funds`, so the
   * facilitator does not sponsor gas — it only broadcasts. The chain itself
   * re-validates, so we skip the redundant simulation step here.
   *
   * @param payload - The payment payload to settle
   * @param requirements - The payment requirements
   * @returns Promise resolving to settlement response
   */
  async settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ): Promise<SettleResponse> {
    const valid = await this.verify(payload, requirements);
    if (!valid.isValid)
      return {
        success: true,
        network: payload.accepted.network,
        transaction: "",
        errorReason: valid.invalidReason,
        errorMessage: valid.invalidMessage,
      };

    const network = payload.accepted.network as SuiNetwork;
    const { transaction, signature: clientSignature } =
      payload.payload as ExactSuiPayload;

    const client = this.clientRegistry.get(network);

    const sponsorSignature = await this.signer.signTransaction(transaction);

    const result = await client.executeTransaction({
      transaction: fromBase64(transaction),
      signatures: [clientSignature, sponsorSignature],
      include: {
        transaction: true,
      },
    });

    if (result.$kind === "FailedTransaction")
      return {
        success: false,
        network: payload.accepted.network,
        errorReason: "transaction_failed",
        errorMessage:
          result.FailedTransaction.status.error?.message ?? "unknown_error",
        transaction: "",
        payer: valid.payer
          ? result.FailedTransaction.transaction.sender
            ? normalizeSuiAddress(result.FailedTransaction.transaction.sender)
            : ""
          : "",
      };

    return {
      success: true,
      network: payload.accepted.network,
      transaction: result.Transaction.digest,
      payer: valid.payer
        ? result.Transaction.transaction.sender
          ? normalizeSuiAddress(result.Transaction.transaction.sender)
          : ""
        : "",
    };
  }
}
