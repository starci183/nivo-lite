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

/** Every NIVO MCP tool the core nodes may call; the back end routes each through the NIVO MCP door. */
export const coreTools: ReadonlyArray<ToolDefinition> = [paymentInstructionTool]
