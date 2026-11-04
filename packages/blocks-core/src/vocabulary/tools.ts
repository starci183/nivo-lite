import { defineTool } from "@nivo-lite/agent-sdk/node"
import type { ToolDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import { MAX_BODY, MAX_ID, MAX_LINE } from "../bounds"

/** What a payment instruction is asked for: the order and the transfer it expects. */
export interface PaymentInstructionArgs {
    /** The number of the order to pay. */
    readonly orderNo: string
    /** The amount to pay, in VND. */
    readonly amountVnd: number
    /** The content the customer must write on the transfer so the credit finds its order. */
    readonly transferContent: string
}

/** Where and how the customer pays, from the provider the workspace connected. */
export interface PaymentInstruction {
    /** The name of the bank. */
    readonly bankName: string
    /** The code of the bank. */
    readonly bankCode: string
    /** The account number to pay into. */
    readonly accountNumber: string
    /** The name the account is held under. */
    readonly accountHolder: string
    /** The address of the QR code that pays the order. */
    readonly qrUrl: string
    /** The provider the workspace connected. */
    readonly provider: string
}

const paymentInstructionArgs: z.ZodType<PaymentInstructionArgs> = z.object({
    orderNo: z.string().min(1).max(MAX_ID),
    amountVnd: z.number().positive(),
    transferContent: z.string().min(1).max(MAX_LINE),
})

const paymentInstruction: z.ZodType<PaymentInstruction> = z.object({
    bankName: z.string().max(MAX_LINE),
    bankCode: z.string().max(MAX_ID),
    accountNumber: z.string().max(MAX_ID),
    accountHolder: z.string().max(MAX_LINE),
    qrUrl: z.string().max(MAX_BODY),
    provider: z.string().max(MAX_ID),
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

const ledgerEntry: z.ZodType<LedgerEntry> = z.object({
    date: z
        .string()
        .length(10)
        .regex(/^\d{4}-\d{2}-\d{2}$/u),
    orderNo: z.string().max(MAX_ID),
    customer: z.string().max(MAX_LINE),
    amountVnd: z.number().nonnegative(),
    transactionId: z.string().min(1).max(MAX_ID),
    status: z.enum(["paid", "void"]),
    note: z.string().max(MAX_BODY),
})

const ledgerRef: z.ZodType<LedgerRef> = z.object({ ref: z.string().max(MAX_BODY) })

/** Records one entry in the business ledger the workspace connected; a transaction is recorded once, however often it is asked. */
export const ledgerAppendTool: ToolDefinition<
    z.ZodType<{ readonly entry: LedgerEntry }>,
    z.ZodType<LedgerRef>
> = defineTool({
    id: "ledger.append",
    title: { key: "toolLedgerAppend" },
    args: z.object({ entry: ledgerEntry }),
    result: ledgerRef,
    mutates: true,
    rights: [],
})

/** Takes an earlier entry back by adding a void entry for its transaction; nothing already written is changed or removed. */
export const ledgerVoidTool: ToolDefinition<
    z.ZodType<{ readonly transactionId: string }>,
    z.ZodType<LedgerRef>
> = defineTool({
    id: "ledger.void",
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
]
