import { defineTool } from "@nivo-lite/agent-sdk/node"
import type { ToolDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"

/** What a payment instruction is asked for: the order and the transfer it expects. */
export interface PaymentInstructionArgs {
    readonly orderNo: string
    readonly amountVnd: number
    readonly transferContent: string
}

/** Where and how the customer pays, from the provider the workspace connected. */
export interface PaymentInstruction {
    readonly bankName: string
    readonly bankCode: string
    readonly accountNumber: string
    readonly accountHolder: string
    readonly qrUrl: string
    readonly provider: string
}

const paymentInstructionArgs: z.ZodType<PaymentInstructionArgs> = z.object({
    orderNo: z.string().min(1),
    amountVnd: z.number().positive(),
    transferContent: z.string().min(1),
})

const paymentInstruction: z.ZodType<PaymentInstruction> = z.object({
    bankName: z.string(),
    bankCode: z.string(),
    accountNumber: z.string(),
    accountHolder: z.string(),
    qrUrl: z.string(),
    provider: z.string(),
})

/** The bank account and the QR a customer pays an order with; reads only, so a condition may call it. */
export const paymentInstructionTool: ToolDefinition<
    z.ZodType<PaymentInstructionArgs>,
    z.ZodType<PaymentInstruction>
> = defineTool({
    id: "payment.instruction",
    title: { key: "toolPaymentInstruction" },
    args: paymentInstructionArgs,
    result: paymentInstruction,
    mutates: false,
    rights: [
        {
            kind: "payment-account",
            access: "read",
            scope: "workspace",
            fields: ["bankName", "bankCode", "accountNumber", "accountHolder"],
        },
    ],
})

/** How a ledger entry stands: the payment it records was received, or the entry takes an earlier one back. */
export type LedgerStatus = "paid" | "void"

/** One line of the business ledger, in the domain's words; where and how it is written (a sheet, a file, an accounting tool) is the provider's. */
export interface LedgerEntry {
    /** The day the money was received, `YYYY-MM-DD`. */
    readonly date: string
    readonly orderNo: string
    readonly customer: string
    readonly amountVnd: number
    /** The bank transaction that paid the order: the one key of an entry. */
    readonly transactionId: string
    readonly status: LedgerStatus
    readonly note: string
}

/** What a ledger write answers: the provider's opaque reference to what it wrote. */
export interface LedgerRef {
    readonly ref: string
}

/** What the workspace has for its ledger. */
export interface LedgerStatusResult {
    /** True when a provider is connected and told where to write. */
    readonly connected: boolean
}

const ledgerEntry: z.ZodType<LedgerEntry> = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
    orderNo: z.string(),
    customer: z.string(),
    amountVnd: z.number().nonnegative(),
    transactionId: z.string().min(1),
    status: z.enum(["paid", "void"]),
    note: z.string(),
})

const ledgerRef: z.ZodType<LedgerRef> = z.object({ ref: z.string() })

/** Records one entry in the business ledger the workspace connected; a transaction is recorded once, however often it is asked. */
export const ledgerAppendTool: ToolDefinition<z.ZodType<{ readonly entry: LedgerEntry }>, z.ZodType<LedgerRef>> = defineTool({
    id: "ledger.append",
    title: { key: "toolLedgerAppend" },
    args: z.object({ entry: ledgerEntry }),
    result: ledgerRef,
    mutates: true,
    rights: [],
})

/** Takes an earlier entry back by adding a void entry for its transaction; nothing already written is changed or removed. */
export const ledgerVoidTool: ToolDefinition<z.ZodType<{ readonly transactionId: string }>, z.ZodType<LedgerRef>> = defineTool({
    id: "ledger.void",
    title: { key: "toolLedgerVoid" },
    args: z.object({ transactionId: z.string().min(1) }),
    result: ledgerRef,
    mutates: true,
    rights: [],
})

/** Whether the workspace has a ledger to write to; reads only, so a condition may call it. */
export const ledgerStatusTool: ToolDefinition<z.ZodType<Record<string, never>>, z.ZodType<LedgerStatusResult>> = defineTool({
    id: "ledger.status",
    title: { key: "toolLedgerStatus" },
    args: z.object({}),
    result: z.object({ connected: z.boolean() }),
    mutates: false,
    rights: [],
})

/** Every NIVO MCP tool the core nodes may call; the back end routes each through the NIVO MCP door. */
export const coreTools: ReadonlyArray<ToolDefinition> = [
    paymentInstructionTool,
    ledgerAppendTool,
    ledgerVoidTool,
    ledgerStatusTool,
] as ReadonlyArray<ToolDefinition>
