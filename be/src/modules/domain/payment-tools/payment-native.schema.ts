import { z } from "zod"
import type { ToolJson } from "@modules/domain/tools"

/**
 * The bounded arguments of the generic payment-instruction tool (`nivo.tool.payment.transfer.create`).
 *
 * The content bound is SePay's documented limit of the transfer description, 94 characters (https://docs.sepay.vn/tao-qr-code-vietqr-dong.html:
 * `des`, up to 94 characters); the newer SePay page (https://developer.sepay.vn/en/tien-ich-khac/tao-qr-code) states none. The amount is a
 * positive whole number of dong: no provider documentation read states a ceiling, so none is invented (the safe-integer bound only keeps it exact).
 */
export const TRANSFER_CONTENT_MAX = 94

export const TRANSFER_CREATE_SCHEMA: z.ZodType<{ amountVnd: number; content: string; }> = z
    .object({
        amountVnd: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).describe("The amount to pay, in VND (a positive whole number)."),
        content: z
            .string()
            .trim()
            .min(1)
            .max(TRANSFER_CONTENT_MAX)
            .describe("The transfer content the payer writes: the caller's own reference (for example an order code). Up to 94 characters."),
    })
    .strict()

/** The schema the manifest announces, generated from the validator. */
export const TRANSFER_CREATE_INPUT_SCHEMA: ToolJson = z.toJSONSchema(TRANSFER_CREATE_SCHEMA, { io: "input" })
