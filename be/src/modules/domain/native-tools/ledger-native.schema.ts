import { z } from "zod"
import type { GatewayJson } from "@modules/domain/mcp-gateway"
import type { BusinessLedgerEntry } from "@modules/domain/provider-registry"

/** The bounded arguments of `ledger.append`: one entry in the domain's words. */
export const LEDGER_APPEND_SCHEMA: z.ZodType<{ readonly entry: BusinessLedgerEntry }> = z
    .object({
        entry: z
            .object({
                date: z
                    .string()
                    .length(10)
                    .regex(/^\d{4}-\d{2}-\d{2}$/u),
                orderNo: z.string().max(64),
                customer: z.string().max(200),
                amountVnd: z.number().min(0).max(1_000_000_000_000),
                transactionId: z.string().min(1).max(200),
                status: z.enum(["paid", "void"]),
                note: z.string().max(500),
            })
            .strict(),
    })
    .strict()

/** The bounded arguments of `ledger.void`: the transaction whose entry is taken back. */
export const LEDGER_VOID_SCHEMA: z.ZodType<{ readonly transactionId: string }> = z
    .object({ transactionId: z.string().min(1).max(200) })
    .strict()

/** `ledger.status` takes no argument. */
export const LEDGER_STATUS_SCHEMA: z.ZodObject<{}, z.core.$strict> = z.object({}).strict()

/** The schemas the manifest announces, generated from the validators. */
export const LEDGER_APPEND_INPUT_SCHEMA: GatewayJson = z.toJSONSchema(LEDGER_APPEND_SCHEMA, { io: "input" })
export const LEDGER_VOID_INPUT_SCHEMA: GatewayJson = z.toJSONSchema(LEDGER_VOID_SCHEMA, { io: "input" })
export const LEDGER_STATUS_INPUT_SCHEMA: GatewayJson = z.toJSONSchema(LEDGER_STATUS_SCHEMA, { io: "input" })
