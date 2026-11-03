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

/** Every NIVO MCP tool the core nodes may call; the back end routes each through the NIVO MCP door. */
export const coreTools: ReadonlyArray<ToolDefinition> = [paymentInstructionTool] as ReadonlyArray<ToolDefinition>
