import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { CRM_NIVOWEB, CRM_NIVOWEB_PROVIDER } from "../../crm/nivoweb/api.generated"
import { type CrmChannel, type PurchaseRef, crmChannelSchema, purchaseRefShape } from "./sales-shapes"
import { DECLINED, valueOrCannot } from "./websales-calls"
import { refused } from "../web-answers"
import { PURCHASE, PURCHASE_ID, crmAnswered, purchaseOf } from "./websales.fixtures"
import { websalesText } from "../../modules/websales/copy"

/**
 * What the send step answered for one purchase it sent. The members are nullable as the send step's output holds them (null when not
 * sent); the round reaches this step only on `sent` (its `ifNode`), so a null here is a contract fault the node stops on.
 */
export type FollowRecordInput = PurchaseRef & {
    /** The channel the follow-up is recorded under; null when it is not recorded. */
    readonly recordChannel: CrmChannel | null
    /** The reference the provider gave the message sent or drafted; null when nothing was sent. */
    readonly messageRef: string | null
}

/** Whether the follow-up was recorded on the purchase, and why not when a person declined the write. */
export type FollowRecordOutput = PurchaseRef & {
    /** True when the CRM recorded the follow-up. */
    readonly recorded: boolean
    /** `declined` when the person asked declined the CRM write; null when recorded. */
    readonly refusal: string | null
    /** True when a person declined the CRM write (a decision: the item ends after the team's notice, the round goes on). */
    readonly declined: boolean
}

const ID = "websales.follow-record"

/** The outcome of a follow-up that went out (the CRM's enum). */
const SENT = "sent"

const input: z.ZodType<FollowRecordInput> = z.object({
    ...purchaseRefShape,
    recordChannel: crmChannelSchema.nullable(),
    messageRef: z.string().min(1).max(200).nullable(),
})

const output: z.ZodType<FollowRecordOutput> = z.object({
    ...purchaseRefShape,
    recorded: z.boolean(),
    refusal: z.string().min(1).max(200).nullable(),
    declined: z.boolean(),
})

/**
 * `websales.follow-record` (Ghi lan nhac): the second body step of the round's loop, split from `websales.follow`, reached only when
 * the reminder went out (the round's `ifNode` on `sent`; an item not sent ends there). A plain call (no AI): the follow-up is recorded
 * on the purchase (`purchase.followup.record`: a CRM write, `auto`) with the channel and the message id the send answered. A person who
 * declines the write is a decision, answered `recorded: false`, `declined: true` (the graph posts the team's notice, then ends the
 * item); any other refusal stops. Re-run after the send, the send
 * answers from the ledger and only this call runs again (per item).
 */
export const websalesFollowRecordNode: TemplateNode<typeof input, typeof output> = defineTemplateNode({
    id: ID,
    title: websalesText("node.follow-record.title"),
    description: { vi: "Ghi l\u1ea1i l\u1ea7n nh\u1eafc b\u00e1o gi\u00e1 v\u1eeba g\u1eedi v\u00e0o \u0111\u01a1n mua, k\u00e8m k\u00eanh \u0111\u00e3 g\u1eedi.", en: "Records the quote follow-up just sent on the purchase, with the channel it went through." },
    tools: [CRM_NIVOWEB.post_purchases_id_followups],
    mode: "auto",
    accounts: [CRM_NIVOWEB_PROVIDER],
    input,
    output,
    run: async (given, context) => {
        const ref = { purchaseId: given.purchaseId, purchaseCode: given.purchaseCode }
        if (given.recordChannel === null || given.messageRef === null) {
            return context.fail({
                kind: "cannot",
                why: "the send step answered no record channel or message id for a sent follow-up",
            })
        }
        const answer = await context.tools.call(CRM_NIVOWEB.post_purchases_id_followups, {
            id: given.purchaseId,
            channel: given.recordChannel,
            outcome: SENT,
            messageRef: given.messageRef,
        })
        if (!answer.ok && answer.declined === true)
            return { ...ref, recorded: false, refusal: DECLINED, declined: true }
        valueOrCannot(context, CRM_NIVOWEB.post_purchases_id_followups, answer)
        return { ...ref, recorded: true, refusal: null, declined: false }
    },
    examples: [
        {
            name: "records the conversation follow-up with the id the send answered",
            params: {},
            input: { ...PURCHASE, recordChannel: "zalo", messageRef: "msg-11" },
            tools: [
                {
                    id: CRM_NIVOWEB.post_purchases_id_followups,
                    args: { id: PURCHASE_ID, channel: "zalo", outcome: "sent", messageRef: "msg-11" },
                    answer: crmAnswered(
                        purchaseOf({
                            followUps: [{ day: "2026-11-12", channel: "zalo", outcome: "sent", messageRef: "msg-11" }],
                        }),
                    ),
                },
            ],
            output: { ...PURCHASE, recorded: true, refusal: null, declined: false },
        },
        {
            name: "records the mailed follow-up as email, by the draft's work item",
            params: {},
            input: { ...PURCHASE, recordChannel: "email", messageRef: "work-11" },
            tools: [
                {
                    id: CRM_NIVOWEB.post_purchases_id_followups,
                    args: { id: PURCHASE_ID, channel: "email", outcome: "sent", messageRef: "work-11" },
                    answer: crmAnswered(
                        purchaseOf({
                            followUps: [
                                { day: "2026-11-12", channel: "email", outcome: "sent", messageRef: "work-11" },
                            ],
                        }),
                    ),
                },
            ],
            output: { ...PURCHASE, recorded: true, refusal: null, declined: false },
        },
        {
            name: "a person who declines the CRM write is a decision: nothing is recorded and the output says declined",
            params: {},
            input: { ...PURCHASE, recordChannel: "zalo", messageRef: "msg-11" },
            tools: [
                {
                    id: CRM_NIVOWEB.post_purchases_id_followups,
                    args: { id: PURCHASE_ID, channel: "zalo", outcome: "sent", messageRef: "msg-11" },
                    answer: refused(DECLINED),
                },
            ],
            output: { ...PURCHASE, recorded: false, refusal: "declined", declined: true },
        },
    ],
})
