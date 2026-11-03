import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import type { NodeSchema } from "../node-schema.types"
import { claimAckOf } from "./claim-ack.policy"
import type { ClaimAckInput, ClaimAckOutput, ClaimAckParams } from "./claim-ack.types"

const ID_MAX = 100
const BODY_MAX = 4000
const NAME_MAX = 200

/** What the agent must hold for the two effects: the host checks it, the node itself reads and writes no data. */
const EFFECT_GRANT = {
    rights: [
        { kind: "payment-claim", access: "write", scope: "turn", fields: ["leadId", "amountVnd", "names", "body"] },
        { kind: "message", access: "write", scope: "turn", fields: ["body"] },
    ],
} as const

const params: NodeSchema<ClaimAckParams> = z.object({ locale: z.enum(["vi", "en"]) })

const input: NodeSchema<ClaimAckInput> = z.object({
    conversationId: z.string().min(1).max(ID_MAX),
    leadId: z.string().min(1).max(ID_MAX),
    body: z.string().min(1).max(BODY_MAX),
    amountVnd: z.number().int().min(1).nullable(),
    payerName: z.string().max(NAME_MAX).nullable(),
})

const output: NodeSchema<ClaimAckOutput> = z.object({
    reply: z.string(),
    claim: z.object({ kind: z.string(), id: z.string() }),
})

/**
 * `payment.claim-ack`: records the payment the customer says they made as a claim (a claim is not evidence), then answers with a neutral
 * line that the transaction is being checked. It never says the payment arrived: only a bank transaction can mark an order paid.
 */
export const paymentClaimAckNode: NodeDefinition<
    NodeSchema<ClaimAckInput>,
    NodeSchema<ClaimAckOutput>,
    NodeSchema<ClaimAckParams>
> = defineNode({
    id: "payment.claim-ack",
    role: "output",
    title: { vi: "Ghi nhận và phản hồi khách báo đã chuyển khoản", en: "Record and acknowledge a payment claim" },
    params,
    input,
    output,
    rights: [],
    effects: ["payment-claim.record", "channel.send"],
    run: async (given, context) => {
        const claim = await context.effect(
            "payment-claim.record",
            {
                leadId: given.leadId,
                conversationId: given.conversationId,
                ...(given.amountVnd === null ? {} : { amountVnd: given.amountVnd }),
                names: given.payerName === null ? [] : [given.payerName],
                body: given.body,
            },
            { dedupeKey: `payment-claim:${context.turn.turnId}` },
        )
        const reply = claimAckOf(given.amountVnd, context.params.locale)
        await context.effect(
            "channel.send",
            { conversationId: given.conversationId, text: reply },
            { dedupeKey: `payment-claim-ack:${context.turn.turnId}` },
        )
        return { reply, claim }
    },
    examples: [
        {
            name: "records the claim of 5k and says the transaction is being checked",
            grant: EFFECT_GRANT,
            params: { locale: "vi" },
            input: {
                conversationId: "c1",
                leadId: "l1",
                body: "Tôi đã chuyển khoản 5k, tên BUI NGUYEN DINH",
                amountVnd: 5000,
                payerName: "BUI NGUYEN DINH",
            },
            output: {
                reply: "Em đang kiểm tra giao dịch 5.000đ của bạn ạ.",
                claim: { kind: "payment-claim.record", id: "payment-claim.record-1" },
            },
            effects: [
                {
                    kind: "payment-claim.record",
                    payload: {
                        leadId: "l1",
                        conversationId: "c1",
                        amountVnd: 5000,
                        names: ["BUI NGUYEN DINH"],
                        body: "Tôi đã chuyển khoản 5k, tên BUI NGUYEN DINH",
                    },
                },
                {
                    kind: "channel.send",
                    payload: { conversationId: "c1", text: "Em đang kiểm tra giao dịch 5.000đ của bạn ạ." },
                },
            ],
        },
        {
            name: "a claim with no amount gets the plain line",
            grant: EFFECT_GRANT,
            params: { locale: "en" },
            input: { conversationId: "c1", leadId: "l1", body: "I paid already", amountVnd: null, payerName: null },
            output: {
                reply: "We are checking your transaction.",
                claim: { kind: "payment-claim.record", id: "payment-claim.record-1" },
            },
            effects: [
                {
                    kind: "payment-claim.record",
                    payload: { leadId: "l1", conversationId: "c1", names: [], body: "I paid already" },
                },
                { kind: "channel.send", payload: { conversationId: "c1", text: "We are checking your transaction." } },
            ],
        },
    ],
})
