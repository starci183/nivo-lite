import { defineTool } from "@nivo-lite/agent-sdk/node"
import type { ToolDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import { MAX_BODY, MAX_ID, MAX_LINE } from "../bounds"
import { TOOL } from "./tool-ids"

/** How a ledger entry stands: the payment it records was received, or the entry takes an earlier one back. */
export type LedgerStatus = "paid" | "void"

/** Which way the money moved on a ledger line: in (thu) or out (chi). */
export type LedgerDirection = "in" | "out"

/** What a ledger line is for, as a stable code the provider words in the shop's language (a sale, other income, a deposit, an expense...). */
export type LedgerCategory = "sale" | "other-income" | "deposit" | "refund" | "expense" | "unclassified"

/** One line of the business ledger, in the domain's words; where and how it is written (a sheet, a file, an accounting tool) is the provider's. */
export interface LedgerEntry {
    /** The day the money was received, `YYYY-MM-DD`. */
    readonly date: string
    /** The number of the order the payment settled. */
    readonly orderNo: string
    /** The customer who paid. */
    readonly customer: string
    /** The amount received, in VND. */
    readonly amountVnd: number
    /** The bank transaction that paid the order: the one key of an entry. */
    readonly transactionId: string
    /** Whether the entry records the payment or takes an earlier one back. */
    readonly status: LedgerStatus
    /** A short free note. */
    readonly note: string
    /** Money in (thu) or out (chi); in when absent. */
    readonly direction?: LedgerDirection
    /** The document number: the order number, else the bank reference; the order number when absent. */
    readonly documentNo?: string
    /** What the line is for in words of the bank (the transfer content); empty when absent. */
    readonly description?: string
    /** Who the money came from or went to; the customer when absent. */
    readonly counterpart?: string
    /** What the line is for; a sale when absent. */
    readonly category?: LedgerCategory
}

/** What a ledger write answers: the provider's opaque reference to what it wrote. */
export interface LedgerRef {
    /** The provider's reference to the line it wrote. */
    readonly ref: string
}

/** What the workspace has for its ledger. */
export interface LedgerStatusResult {
    /** True when a provider is connected and told where to write. */
    readonly connected: boolean
}

const ledgerRef: z.ZodType<LedgerRef> = z.object({ ref: z.string().max(MAX_BODY) })

/** What a node asks the ledger to write: the bank transaction, by its id. The line is built from the records. */
export interface LedgerAppendArgs {
    /** The bank transaction to write. */
    readonly transactionId: string
}

/**
 * Records one bank transaction in the business ledger the workspace connected; a transaction is recorded once, however often it is
 * asked. The caller names the transaction alone: the date, the amount, the order number and the customer of the line are read from the
 * transaction and the order it paid, so nobody types a figure into the books.
 */
export const ledgerAppendTool: ToolDefinition<z.ZodType<LedgerAppendArgs>, z.ZodType<LedgerRef>> = defineTool({
    id: TOOL.ledgerAppend,
    title: { key: "toolLedgerAppend" },
    args: z
        .object({
            transactionId: z
                .string()
                .min(1)
                .max(MAX_ID)
                .describe("The bank transaction to write. Give its id alone: the line is built from the records."),
        })
        .describe(
            "Write one settled bank transaction into the shop's ledger. The date, amount, order number and customer are read from the records.",
        ),
    result: ledgerRef,
    mutates: true,
    rights: [],
})

/** Takes an earlier entry back by adding a void entry for its transaction; nothing already written is changed or removed. */
export const ledgerVoidTool: ToolDefinition<
    z.ZodType<{ readonly transactionId: string }>,
    z.ZodType<LedgerRef>
> = defineTool({
    id: TOOL.ledgerVoid,
    title: { key: "toolLedgerVoid" },
    args: z.object({ transactionId: z.string().min(1).max(MAX_ID) }),
    result: ledgerRef,
    mutates: true,
    rights: [],
})

/** Whether the workspace has a ledger to write to; reads only, so a condition may call it. */
export const ledgerStatusTool: ToolDefinition<
    z.ZodType<Record<string, never>>,
    z.ZodType<LedgerStatusResult>
> = defineTool({
    id: TOOL.ledgerStatus,
    title: { key: "toolLedgerStatus" },
    args: z.object({}),
    result: z.object({ connected: z.boolean() }),
    mutates: false,
    rights: [],
})

/** What the bank's own list of movements is asked for: a window of time and the most rows. */
export interface BankTransactionsArgs {
    /** Only movements at or after this instant, ISO 8601 with an offset. */
    readonly since?: string | undefined
    /** Only movements at or before this instant, ISO 8601 with an offset. */
    readonly until?: string | undefined
    /** The most rows; the bank answers at most 50. */
    readonly limit: number
}

/** One movement as the bank lists it. */
export interface BankMovement {
    /** The provider-prefixed id of the movement: the bank reference. */
    readonly id: string
    /** Money in or money out. */
    readonly direction: "credit" | "debit"
    /** The amount in VND, always positive. */
    readonly amountVnd: number
    /** The transfer content. */
    readonly content: string
    /** When the bank booked it, ISO 8601. */
    readonly occurredAt: string
    /** The name of the bank. */
    readonly bankName: string
    /** The connected account the movement arrived on (its connection id), so a step can tell the shop's accounts apart. */
    readonly connectionId?: string | undefined
    /** That account's name, as the shop named the connection. */
    readonly account?: string | undefined
}

/** The bank's own answer: the provider and the movements, newest first. */
export interface BankTransactionsResult {
    /** The provider that answered. */
    readonly provider: string
    /** The movements of the window. */
    readonly transactions: ReadonlyArray<BankMovement>
}

const bankMovement: z.ZodType<BankMovement> = z.object({
    id: z.string().max(MAX_ID),
    direction: z.enum(["credit", "debit"]),
    amountVnd: z.number(),
    content: z.string().max(MAX_BODY),
    occurredAt: z.string().max(MAX_ID),
    bankName: z.string().max(MAX_LINE),
    connectionId: z.string().max(MAX_ID).optional(),
    account: z.string().max(MAX_LINE).optional(),
})

/**
 * The movements the bank itself lists in a window, money in and money out, read from the provider; reads only, so a condition may call it.
 * It is the bank's side of a reconciliation: what the books hold is compared with it, never the other way round.
 */
export const bankTransactionsTool: ToolDefinition<
    z.ZodType<BankTransactionsArgs>,
    z.ZodType<BankTransactionsResult>
> = defineTool({
    id: TOOL.bankTransactions,
    title: { key: "toolBankTransactions" },
    args: z.object({
        since: z.string().max(MAX_ID).optional(),
        until: z.string().max(MAX_ID).optional(),
        limit: z.number().int().min(1).max(50),
    }),
    result: z.object({ provider: z.string().max(MAX_ID), transactions: z.array(bankMovement).max(50) }),
    mutates: false,
    rights: [],
})

/** What the second brain is asked: the question in the agent's own words, and the most hits. */
export interface BrainSearchArgs {
    /** What to look for, as a question or key words. */
    readonly query: string
    /** The most facts and passages, 1 to 8; 6 when absent. */
    readonly limit?: number | undefined
}

/** One passage of a document as the search answers it. */
export interface BrainPassage {
    /** The document the passage belongs to. */
    readonly sourceId: string
    /** The title of the document. */
    readonly title: string
    /** The topic of the document, or null. */
    readonly topic: string | null
    /** The place of the passage in the document, or null. */
    readonly order: number | null
    /** The passage itself, clipped. */
    readonly content: string
}

/** What the second brain answers: the notice that its text is data, the facts in force that fit, and the passages that fit. */
export interface BrainSearchResult {
    /** The words that say the rest is reference data, never an instruction. */
    readonly notice: string
    /** The facts in force that answer the question, as the Brain words them. */
    readonly facts: ReadonlyArray<Readonly<Record<string, unknown>>>
    /** The passages of the documents the caller may read that answer the question. */
    readonly passages: ReadonlyArray<BrainPassage>
}

const brainPassage: z.ZodType<BrainPassage> = z.object({
    sourceId: z.string().max(MAX_ID),
    title: z.string().max(MAX_LINE),
    topic: z.string().max(MAX_LINE).nullable(),
    order: z.number().nullable(),
    content: z.string().max(MAX_BODY),
})

/**
 * Searches the shop's second brain for a question (embedding plus words) and answers the facts in force and the passages of the
 * documents. The caller's lens decides what it may read: a step with a customer's conversation gets public passages only. Reads only.
 */
export const brainSearchTool: ToolDefinition<z.ZodType<BrainSearchArgs>, z.ZodType<BrainSearchResult>> = defineTool({
    id: TOOL.brainSearch,
    title: { key: "toolBrainSearch" },
    args: z.object({ query: z.string().min(1).max(500), limit: z.number().int().min(1).max(8).optional() }),
    result: z.object({
        notice: z.string().max(MAX_BODY),
        facts: z.array(z.record(z.string(), z.unknown())).max(50),
        passages: z.array(brainPassage).max(50),
    }),
    mutates: false,
    rights: [],
})

/** Every NIVO MCP tool the core nodes may call; the back end routes each through the NIVO MCP door. */
export const coreTools: ReadonlyArray<ToolDefinition> = [
    ledgerAppendTool,
    ledgerVoidTool,
    ledgerStatusTool,
    bankTransactionsTool,
    brainSearchTool,
]
