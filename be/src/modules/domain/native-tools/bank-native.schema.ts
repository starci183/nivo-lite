import { z } from "zod"
import type { GatewayJson } from "@modules/domain/mcp-gateway"

/** What `nivo.bank.transaction.list` is asked for. */
export type BankTransactionsArgs = {
    /** Only transactions at or after this instant, ISO 8601. */
    readonly since?: string | undefined
    /** Only transactions at or before this instant, ISO 8601. */
    readonly until?: string | undefined
    /** The most rows. */
    readonly limit: number
}

/** The bounded arguments of `nivo.bank.transaction.list`. */
export const BANK_TRANSACTIONS_SCHEMA: z.ZodType<BankTransactionsArgs> = z
    .object({
        since: z.iso.datetime({ offset: true }).max(40).optional(),
        until: z.iso.datetime({ offset: true }).max(40).optional(),
        limit: z.number().int().min(1).max(50).default(20),
    })
    .strict()

/** The schema `nivo.bank.transaction.list` announces, generated from its argument validator. */
export const BANK_TRANSACTIONS_INPUT_SCHEMA: GatewayJson = z.toJSONSchema(BANK_TRANSACTIONS_SCHEMA, { io: "input" })
