import { z } from "zod"
import type { ToolJson } from "@modules/domain/tools"

/** What `nivo.tool.bank.transaction.list` is asked for. */
export type BankTransactionsArgs = {
    /** Only transactions at or after this instant, ISO 8601. */
    readonly since?: string | undefined
    /** Only transactions at or before this instant, ISO 8601. */
    readonly until?: string | undefined
    /** The most rows. */
    readonly limit: number
}

/** The bounded arguments of `nivo.tool.bank.transaction.list`. */
export const BANK_TRANSACTIONS_SCHEMA: z.ZodType<BankTransactionsArgs> = z
    .object({
        since: z.iso.datetime({ offset: true }).max(40).optional(),
        until: z.iso.datetime({ offset: true }).max(40).optional(),
        limit: z.number().int().min(1).max(50).default(20),
    })
    .strict()

/** The schema `nivo.tool.bank.transaction.list` announces, generated from its argument validator. */
export const BANK_TRANSACTIONS_INPUT_SCHEMA: ToolJson = z.toJSONSchema(BANK_TRANSACTIONS_SCHEMA, { io: "input" })
