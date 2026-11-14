import { PROVIDER, TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID, MAX_LINE } from "../../../shared/bounds"
import { bilingualOf } from "../../../shared/messages/catalog"
import type { NodeSchema } from "../../../shared/nodes/node-schema.types"
import { answered, refused, valueOrCannot } from "../../../shared/nodes/tool-answers"

/** The order the transfer is for: its code (the transfer content) and its exact total. */
export interface RequestQrInput {
    /** The order's code: the content the payer writes, which the payment graph finds in the bank's credit. */
    readonly orderNo: string
    /** The order's exact total, VND. */
    readonly amountVnd: number
}

/** The bank-transfer instruction the tool composed: the QR picture and the account it pays into. */
export interface TransferQr {
    /** The address of the QR picture, or null when the provider gave none. */
    readonly qrImageUrl: string | null
    /** The bank's code, or null. */
    readonly bankCode: string | null
    /** The receiving account's number. */
    readonly accountNumber: string
    /** The receiving account's holder, or null. */
    readonly accountHolder: string | null
    /** The transfer content, as the tool keeps it. */
    readonly content: string
    /** The amount, VND, as the tool keeps it. */
    readonly amountVnd: number
}

/** The longest address of a QR picture. */
const MAX_URL = 2048

/** The longest transfer content the tool takes (SePay's documented limit). */
const MAX_CONTENT = 94

const input: NodeSchema<RequestQrInput> = z.object({
    orderNo: z.string().min(1).max(MAX_CONTENT),
    amountVnd: z.number().int().positive(),
})

const output: NodeSchema<TransferQr> = z.object({
    qrImageUrl: z.string().min(1).max(MAX_URL).nullable().describe("The address of the QR picture, or null when the provider gave none."),
    bankCode: z.string().min(1).max(MAX_ID).nullable().describe("The bank's code, or null."),
    accountNumber: z.string().min(1).max(MAX_ID).describe("The receiving account's number."),
    accountHolder: z.string().min(1).max(MAX_LINE).nullable().describe("The receiving account's holder, or null."),
    content: z.string().min(1).max(MAX_CONTENT).describe("The transfer content: the order's code."),
    amountVnd: z.number().int().positive().describe("The amount to transfer, VND: the order's exact total."),
})

/** What `nivo.tool.payment.transfer.create` answers, read for the members the step hands on. */
const answerShape = z.object({
    qrImageUrl: z.string().min(1).max(MAX_URL).optional(),
    bankCode: z.string().min(1).max(MAX_ID).optional(),
    accountNumber: z.string().min(1).max(MAX_ID),
    accountHolder: z.string().min(1).max(MAX_LINE).optional(),
    content: z.string().min(1).max(MAX_CONTENT),
    amountVnd: z.number().int().positive(),
})

/** The order of the examples. */
const ORDER: RequestQrInput = { orderNo: "DH-20261113-0001", amountVnd: 4500 }

/** The instruction of the examples, as the tool answers it for a SePay account. */
const INSTRUCTION = {
    qrImageUrl: "https://vietqr.app/img?acc=123456&bank=ACB&amount=4500&des=DH-20261113-0001",
    bankCode: "ACB",
    accountNumber: "123456",
    accountHolder: "HOA SHOP",
    content: "DH-20261113-0001",
    amountVnd: 4500,
}

/**
 * `sales.request-qr` (Tao ma QR chuyen khoan): asks the bank-transfer instruction of the order (`nivo.tool.payment.transfer.create`) with
 * the order's exact total as the amount and its code as the content, into the workspace's receiving account (the agent's `sepay`
 * account). The tool composes the QR and the account details only: it moves no money and settles nothing. Plain data: nothing is
 * decided or compared. A refusal (no account connected) stops the run with it: the engine reports it to the team.
 */
export const salesRequestQrNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: "sales.request-qr",
    title: bilingualOf("nodeSalesRequestQrTitle"),
    description: { vi: "T\u1ea1o h\u01b0\u1edbng d\u1eabn chuy\u1ec3n kho\u1ea3n v\u00e0 m\u00e3 QR cho \u0111\u01a1n, \u0111\u00fang s\u1ed1 ti\u1ec1n v\u00e0 m\u00e3 \u0111\u01a1n, v\u00e0o t\u00e0i kho\u1ea3n nh\u1eadn ti\u1ec1n c\u1ee7a shop.", en: "Creates the bank-transfer instruction and QR for the order, with its exact amount and code, into the shop's receiving account." },
    tools: [TOOL.paymentTransferCreate],
    mode: "auto",
    accounts: [PROVIDER.sepay],
    input,
    output,
    run: async (given, context) => {
        const answer = answerShape.safeParse(
            valueOrCannot(
                context,
                TOOL.paymentTransferCreate,
                await context.tools.call(TOOL.paymentTransferCreate, { amountVnd: given.amountVnd, content: given.orderNo }),
            ),
        )
        if (!answer.success) return context.fail({ kind: "cannot", why: `${TOOL.paymentTransferCreate} answered an unknown shape` })
        const { qrImageUrl, bankCode, accountNumber, accountHolder, content, amountVnd } = answer.data
        return {
            qrImageUrl: qrImageUrl ?? null,
            bankCode: bankCode ?? null,
            accountNumber,
            accountHolder: accountHolder ?? null,
            content,
            amountVnd,
        }
    },
    examples: [
        {
            name: "the QR of the order is asked with its exact total and its code as the transfer content",
            params: {},
            input: ORDER,
            tools: [
                {
                    id: TOOL.paymentTransferCreate,
                    args: { amountVnd: 4500, content: "DH-20261113-0001" },
                    answer: answered(INSTRUCTION),
                },
            ],
            output: INSTRUCTION,
        },
        {
            name: "a refused instruction (no receiving account connected) stops the run with the refusal",
            params: {},
            input: ORDER,
            tools: [
                {
                    id: TOOL.paymentTransferCreate,
                    args: { amountVnd: 4500, content: "DH-20261113-0001" },
                    answer: refused("not_connected"),
                },
            ],
            failure: { kind: "cannot", why: `${TOOL.paymentTransferCreate} refused: not_connected` },
        },
    ],
})
