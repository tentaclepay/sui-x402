import { z } from "zod";

import type { SUI_NETWORK_CAIP2_LIST } from "./constants";

export type SuiNetwork = (typeof SUI_NETWORK_CAIP2_LIST)[number];

export type SuiAddress = `0x${string}`;

export const exactSuiPayloadSchema = z.object({
  transaction: z.base64({
    error: "Invalid transaction",
  }),
  signature: z.base64({
    error: "Invalid signature",
  }),
});
export type ExactSuiPayload = z.infer<typeof exactSuiPayloadSchema>;
