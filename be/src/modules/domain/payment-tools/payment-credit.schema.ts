import { z } from "zod"
import type { ToolJson } from "@modules/domain/tools"

/** The longest provider id of a move the tool takes (a feed's id with its provider prefix, e.g. `sepay:94624259`). */
const CREDIT_ID_MAX = 128

/**
 * The bounded arguments of `nivo.tool.payment.credit.get`: the PROVIDER'S id of the move, exactly as the bank trigger's event carries it
 * (`data.transactionId`, the key the feed's intake kept the raw row under), never the row's own id (ruling R51 item 2).
 */
export const CREDIT_GET_SCHEMA: z.ZodType<{ transactionId: string; }> = z
    .object({ transactionId: z.string().min(1).max(CREDIT_ID_MAX).describe("The id of the bank move, as the bank trigger's `data.transactionId` names it.") })
    .strict()

/** The schema the manifest announces, generated from the validator. */
export const CREDIT_GET_INPUT_SCHEMA: ToolJson = z.toJSONSchema(CREDIT_GET_SCHEMA, { io: "input" })
