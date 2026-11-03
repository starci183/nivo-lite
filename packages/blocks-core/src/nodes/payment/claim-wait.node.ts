import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import { channelSendEffect } from "../../vocabulary"
import { CLAIM_DINH, STORE_REAL_CASE } from "./payment.fixtures"
import { READ_CLAIMS } from "./payment.rights"
import type { ClaimRow } from "./payment.schemas"

/** Which claim, and whether the wait for the money has run out. */
interface ClaimWaitInput {
    readonly claimId: string
    readonly timedOut: boolean
}

/** `waiting`: the customer was answered, resume on the next transaction or after `resumeAfterMinutes`. `escalated`: the owner was asked. `closed`: the claim was settled meanwhile. */
interface ClaimWaitOutput {
    readonly state: "waiting" | "escalated" | "closed"
    readonly resumeAfterMinutes: number | null
}

/** The wait, and the words: the neutral reply to the customer and the title of the owner's work item. */
interface ClaimWaitParams {
    readonly timeoutMinutes: number
    readonly neutralText: string
    readonly overdueTitle: string
}

const params: z.ZodType<ClaimWaitParams> = z.object({
    timeoutMinutes: z.number().int().positive().default(30),
    neutralText: z.string().min(1),
    overdueTitle: z.string().min(1),
})
const input: z.ZodType<ClaimWaitInput, ClaimWaitInput> = z.object({ claimId: z.string(), timedOut: z.boolean() })
const output: z.ZodType<ClaimWaitOutput, ClaimWaitOutput> = z.object({
    state: z.enum(["waiting", "escalated", "closed"]),
    resumeAfterMinutes: z.number().nullable(),
})

/** The agent's grant in the examples: the node's own rights and what the effects it runs need (the host checks the grant for them). */
const GRANT = { rights: [READ_CLAIMS, ...channelSendEffect.rights] }

/**
 * A customer says they paid and no matching money has arrived. The first run answers them neutrally in the conversation they wrote in
 * (`channel.send`: never a confirmation, Chatbot and Sales cannot confirm a payment) and waits: the graph resumes it on the next tagged
 * transaction (the evidence node then reads the claim) or, with `timedOut`, when the configured wait ran out, which raises a work item for the
 * owner (`work-item.raise`). A claim that was settled meanwhile is closed and says nothing.
 */
export const paymentClaimWaitNode: NodeDefinition<
    z.ZodType<ClaimWaitInput, ClaimWaitInput>,
    z.ZodType<ClaimWaitOutput, ClaimWaitOutput>,
    z.ZodType<ClaimWaitParams>
> = defineNode({
    id: "payment.claim-wait",
    role: "output",
    title: { key: "paymentClaimWait" },
    params,
    input,
    output,
    rights: [READ_CLAIMS],
    effects: ["channel.send", "work-item.raise"],
    run: async (given, context) => {
        const settings = context.params
        const [claim] = await context.data.read<ClaimRow>("payment-claim", {
            where: { id: given.claimId },
            fields: READ_CLAIMS.fields,
            limit: 1,
        })
        if (claim === undefined || claim.status !== "open") return { state: "closed", resumeAfterMinutes: null }
        if (given.timedOut) {
            await context.effect(
                "work-item.raise",
                {
                    action: "reconcile_payment",
                    title: settings.overdueTitle,
                    payload: { target: "order", claimId: claim.id, leadId: claim.leadId, body: claim.body },
                    ...(claim.amountVnd === null ? {} : { amountVnd: claim.amountVnd }),
                    claimId: claim.id,
                },
                { dedupeKey: `payment-claim:${claim.id}` },
            )
            return { state: "escalated", resumeAfterMinutes: null }
        }
        if (claim.conversationId !== null) {
            await context.effect(
                "channel.send",
                { conversationId: claim.conversationId, text: settings.neutralText },
                { dedupeKey: `payment-claim-reply:${claim.id}` },
            )
        }
        return { state: "waiting", resumeAfterMinutes: settings.timeoutMinutes }
    },
    examples: [
        {
            name: "Định's claim at 00:54 with no money yet: a neutral reply on Zalo, then wait 30 minutes",
            params: {
                timeoutMinutes: 30,
                neutralText: "Shop chưa nhận được khoản chuyển khoản, đang theo dõi.",
                overdueTitle: "Khách báo đã chuyển khoản nhưng chưa thấy tiền",
            },
            input: { claimId: CLAIM_DINH.id, timedOut: false },
            output: { state: "waiting", resumeAfterMinutes: 30 },
            effects: [
                {
                    kind: "channel.send",
                    payload: {
                        conversationId: "conversation-dinh",
                        text: "Shop chưa nhận được khoản chuyển khoản, đang theo dõi.",
                    },
                },
            ],
            store: STORE_REAL_CASE,
            grant: GRANT,
        },
        {
            name: "the wait ran out and no money came: the owner gets a work item",
            params: {
                timeoutMinutes: 30,
                neutralText: "Shop chưa nhận được khoản chuyển khoản, đang theo dõi.",
                overdueTitle: "Khách báo đã chuyển khoản nhưng chưa thấy tiền",
            },
            input: { claimId: CLAIM_DINH.id, timedOut: true },
            output: { state: "escalated", resumeAfterMinutes: null },
            effects: [
                {
                    kind: "work-item.raise",
                    payload: {
                        action: "reconcile_payment",
                        title: "Khách báo đã chuyển khoản nhưng chưa thấy tiền",
                        payload: { target: "order", claimId: CLAIM_DINH.id, leadId: "lead-dinh", body: CLAIM_DINH.body },
                        amountVnd: 5000,
                        claimId: "claim-dinh",
                    },
                },
            ],
            store: STORE_REAL_CASE,
            grant: GRANT,
        },
        {
            name: "a claim that named no amount, timed out: the work item carries no amount",
            params: { timeoutMinutes: 30, neutralText: "x", overdueTitle: "y" },
            input: { claimId: CLAIM_DINH.id, timedOut: true },
            output: { state: "escalated", resumeAfterMinutes: null },
            effects: [
                {
                    kind: "work-item.raise",
                    payload: {
                        action: "reconcile_payment",
                        title: "y",
                        payload: { target: "order", claimId: CLAIM_DINH.id, leadId: "lead-dinh", body: CLAIM_DINH.body },
                        claimId: CLAIM_DINH.id,
                    },
                },
            ],
            store: { ...STORE_REAL_CASE, "payment-claim": [{ ...CLAIM_DINH, amountVnd: null }] },
            grant: GRANT,
        },
        {
            name: "a claim with no conversation to answer in waits without saying anything",
            params: { timeoutMinutes: 30, neutralText: "x", overdueTitle: "y" },
            input: { claimId: CLAIM_DINH.id, timedOut: false },
            output: { state: "waiting", resumeAfterMinutes: 30 },
            effects: [],
            store: { ...STORE_REAL_CASE, "payment-claim": [{ ...CLAIM_DINH, conversationId: null }] },
            grant: GRANT,
        },
        {
            name: "a claim that is not found is closed",
            params: { timeoutMinutes: 30, neutralText: "x", overdueTitle: "y" },
            input: { claimId: "ghost", timedOut: false },
            output: { state: "closed", resumeAfterMinutes: null },
            effects: [],
            store: STORE_REAL_CASE,
            grant: GRANT,
        },
        {
            name: "the money arrived and settled the claim meanwhile: closed, nothing is said",
            params: { timeoutMinutes: 30, neutralText: "x", overdueTitle: "y" },
            input: { claimId: CLAIM_DINH.id, timedOut: true },
            output: { state: "closed", resumeAfterMinutes: null },
            effects: [],
            store: { ...STORE_REAL_CASE, "payment-claim": [{ ...CLAIM_DINH, status: "settled" }] },
            grant: GRANT,
        },
    ],
})
