import { z } from "zod"
import type { GatewayJson } from "@modules/domain/mcp-gateway"
import type { BusinessLedgerEntry } from "@modules/domain/provider-registry"

/** One entry in the domain's words, as the declared job of the books hands it over. */
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

/** A bank transaction named by its id: the tool builds the entry from the records. */
const BY_TRANSACTION_SCHEMA: z.ZodType<{ readonly transactionId: string }> = z
    .object({ transactionId: z.string().min(1).max(200) })
    .strict()

/**
 * The bounded arguments of `ledger.append`: the bank transaction to write, by its id (what a step's agent gives: the line is built from
 * the records), or one whole entry in the domain's words (what the declared job of the books gives, built by its own rules).
 */
export const LEDGER_APPEND_SCHEMA: z.ZodType<
    { readonly entry: BusinessLedgerEntry } | { readonly transactionId: string }
> = z.union([BY_TRANSACTION_SCHEMA, ENTRY_SCHEMA])

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
