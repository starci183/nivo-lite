import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { CRM_NIVOWEB, CRM_NIVOWEB_PROVIDER } from "../../crm/nivoweb/api.generated"
import { LINE_MAX, idSchema, jsonText } from "./books-shapes"
import { crmOk, refused } from "./books.fixtures"
import { webbooksText } from "../../modules/webbooks/copy"

/**
 * The receivable whose customer mail went, the send's reference and the draft step's line. The graph reaches this step only when
 * the mail went (`drafted`), but a presence check does not narrow a ref: the reference and the line are typed nullable, and a null
 * reference is recorded without one (the CRM's `messageRef` is optional), never skipped.
 */
const input = z.object({
    projectCode: idSchema,
    messageRef: idSchema.nullable(),
    why: z.string().min(1).max(LINE_MAX).nullable(),
})

/**
 * What the round recorded for one receivable whose customer was mailed: the shape the round's report reads. A receivable with no
 * customer mail never reaches this step: its loop item's output is null.
 */
export type NoticeOutput = {
    /** The project receivable reminded. */
    readonly projectCode: string
    /** The notice the CRM recorded; null when the CRM (or the person asked) refused it. */
    readonly noticeId: string | null
    /** The refusal of the record; null when it was recorded. */
    readonly refusal: string | null
    /** True when a person declined the record (a decision): the graph tells the team and ends the item. */
    readonly declined: boolean
    /** One line for the team: what was done and why; null when the draft step answered none. */
    readonly why: string | null
}

/** The schema of what the step did: the loop's `collect`, read by the round's report. */
export const noticeOutputSchema: z.ZodType<NoticeOutput> = z.object({
    projectCode: idSchema,
    noticeId: idSchema.nullable(),
    refusal: z.string().max(LINE_MAX).nullable(),
    declined: z.boolean().describe("True when a person declined the record."),
    why: z.string().min(1).max(LINE_MAX).nullable(),
})

/** The channel the CRM records the notice under: the mail (the only way this round tells a customer). */
const CHANNEL = "email"

const WHY = "Soan thu nhac cho khach, cho nguoi duyet gui."

/**
 * `webbooks.notice-record` (Record the notice): split from `webbooks.notice`, the last body step of the receivable round and the
 * loop's `collect`, reached only once the customer mail went (the graph's `drafted` check ends any other item). One CRM write,
 * `receivable.notice.record`, by the project code and the mail's reference. No AI call. A refusal (the CRM already holds
 * this notice, the receivable closed) is answered as a fact for the report. A person who declines the record made a decision: the
 * step returns it (`declined` true, the refusal kept for the report) and the graph routes the item to the team notice, then ends it.
 * Blocking: the record is the item's business.
 */
export const webbooksNoticeRecordNode: TemplateNode = defineTemplateNode({
    id: "webbooks.notice-record",
    title: webbooksText("node.notice-record.title"),
    description: { vi: "Ghi nh\u1eadn l\u1ea7n nh\u1eafc n\u1ee3 \u0111\u00e3 g\u1eedi v\u00e0o kho\u1ea3n ph\u1ea3i thu.", en: "Records the reminder that was sent on the receivable." },
    tools: [CRM_NIVOWEB.post_receivables_code_notices],
    mode: "auto",
    accounts: [CRM_NIVOWEB_PROVIDER],
    input,
    output: noticeOutputSchema,
    sensitive: { why: "pii" },
    run: async (given, ctx) => {
        const recorded = await ctx.tools.call(CRM_NIVOWEB.post_receivables_code_notices, {
            code: given.projectCode,
            channel: CHANNEL,
            ...(given.messageRef === null ? {} : { messageRef: given.messageRef }),
        })
        const base = { projectCode: given.projectCode, why: given.why }
        if (!recorded.ok && recorded.declined === true)
            return { ...base, noticeId: null, refusal: "declined", declined: true }
        if (!recorded.ok) return { ...base, noticeId: null, refusal: recorded.refusal, declined: false }
        return { ...base, noticeId: jsonText(recorded.value["id"]), refusal: null, declined: false }
    },
    examples: [
        {
            name: "records the notice on the receivable by the mail's reference",
            params: {},
            input: { projectCode: "SITE2-WEB", messageRef: "mail-0001", why: WHY },
            tools: [
                {
                    id: CRM_NIVOWEB.post_receivables_code_notices,
                    args: { code: "SITE2-WEB", channel: CHANNEL, messageRef: "mail-0001" },
                    answer: crmOk({ id: "notice-0001", state: "recorded" }),
                },
            ],
            output: { projectCode: "SITE2-WEB", noticeId: "notice-0001", refusal: null, declined: false, why: WHY },
        },
        {
            name: "the CRM refuses the record: no notice id, the refusal for the report",
            params: {},
            input: { projectCode: "SITE2-WEB", messageRef: "mail-0001", why: WHY },
            tools: [
                {
                    id: CRM_NIVOWEB.post_receivables_code_notices,
                    args: { code: "SITE2-WEB", channel: CHANNEL, messageRef: "mail-0001" },
                    answer: refused("receivable_closed"),
                },
            ],
            output: {
                projectCode: "SITE2-WEB",
                noticeId: null,
                refusal: "receivable_closed",
                declined: false,
                why: WHY,
            },
        },
        {
            name: "a person declines the record: no notice id, declined returned (the graph tells the team, the item ends)",
            params: {},
            input: { projectCode: "SITE2-WEB", messageRef: "mail-0001", why: WHY },
            tools: [
                {
                    id: CRM_NIVOWEB.post_receivables_code_notices,
                    args: { code: "SITE2-WEB", channel: CHANNEL, messageRef: "mail-0001" },
                    answer: refused("declined"),
                },
            ],
            output: { projectCode: "SITE2-WEB", noticeId: null, refusal: "declined", declined: true, why: WHY },
        },
    ],
})
