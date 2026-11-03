import { z } from "zod"
import type { GatewayJson } from "@modules/domain/mcp-gateway"

/** What `payment.instruction` is asked for. */
export type PaymentInstructionArgs = {
    /** The order the payment is for. */
    readonly orderNo: string
    /** The amount to pay, in VND. */
    readonly amountVnd: number
    /** The transfer content the payer must write. */
    readonly transferContent: string
}

/** The bounded arguments of `payment.instruction`. */
export const PAYMENT_INSTRUCTION_SCHEMA: z.ZodType<PaymentInstructionArgs> = z
    .object({
        orderNo: z.string().min(1).max(64),
        amountVnd: z.number().int().min(1).max(1_000_000_000_000),
        transferContent: z.string().min(1).max(200),
    })
    .strict()

/** The schema `payment.instruction` announces, generated from its argument validator. */
export const PAYMENT_INSTRUCTION_INPUT_SCHEMA: GatewayJson = z.toJSONSchema(PAYMENT_INSTRUCTION_SCHEMA, {
    io: "input",
})

/** What `bank.transactions` is asked for. */
export type BankTransactionsArgs = {
    /** Only transactions at or after this instant, ISO 8601. */
    readonly since?: string | undefined
    /** Only transactions at or before this instant, ISO 8601. */
    readonly until?: string | undefined
    /** The most rows. */
    readonly limit: number
}

/** The bounded arguments of `bank.transactions`. */
export const BANK_TRANSACTIONS_SCHEMA: z.ZodType<BankTransactionsArgs> = z
    .object({
        since: z.iso.datetime({ offset: true }).max(40).optional(),
        until: z.iso.datetime({ offset: true }).max(40).optional(),
        limit: z.number().int().min(1).max(50).default(20),
    })
    .strict()

/** The schema `bank.transactions` announces, generated from its argument validator. */
export const BANK_TRANSACTIONS_INPUT_SCHEMA: GatewayJson = z.toJSONSchema(BANK_TRANSACTIONS_SCHEMA, { io: "input" })
