import { z } from "zod"
import type { ToolJson } from "@modules/domain/tools"
import type { BusinessLedgerEntry } from "@modules/domain/provider-registry"

/** One entry in the domain's words, as the caller hands it over. */
const ENTRY_SCHEMA: z.ZodType<{ readonly entry: BusinessLedgerEntry }> = z
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
                direction: z.enum(["in", "out"]).exactOptional(),
                documentNo: z.string().max(200).exactOptional(),
                description: z.string().max(500).exactOptional(),
                counterpart: z.string().max(500).exactOptional(),
                category: z
                    .enum(["sale", "other-income", "deposit", "refund", "expense", "unclassified"])
                    .exactOptional(),
            })
            .strict(),
    })
    .strict()

/**
 * The bounded arguments of `nivo.tool.ledger.entry.append`: one whole entry in the domain's words, built by the caller's own rules (a
 * module's declared job or a step of its agent). The engine builds no entry: what becomes a line of a business's books is that
 * business's.
 */
export const LEDGER_APPEND_SCHEMA: z.ZodType<{ readonly entry: BusinessLedgerEntry }> = ENTRY_SCHEMA

/** The bounded arguments of `nivo.tool.ledger.entry.void`: the transaction whose entry is taken back. */
export const LEDGER_VOID_SCHEMA: z.ZodType<{ readonly transactionId: string }> = z
    .object({ transactionId: z.string().min(1).max(200) })
    .strict()

/** `nivo.tool.ledger.status.get` takes no argument. */
export const LEDGER_STATUS_SCHEMA: z.ZodObject<{}, z.core.$strict> = z.object({}).strict()

/** The schemas the manifest announces, generated from the validators. */
export const LEDGER_APPEND_INPUT_SCHEMA: ToolJson = z.toJSONSchema(LEDGER_APPEND_SCHEMA, { io: "input" })
export const LEDGER_VOID_INPUT_SCHEMA: ToolJson = z.toJSONSchema(LEDGER_VOID_SCHEMA, { io: "input" })
export const LEDGER_STATUS_INPUT_SCHEMA: ToolJson = z.toJSONSchema(LEDGER_STATUS_SCHEMA, { io: "input" })
