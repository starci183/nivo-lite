import { TOOL } from "@nivo-lite/agent-sdk/names"
import { type TemplateNode, defineTemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { webmailText } from "../../modules/webmail/copy"
import { answered, refused } from "../web-answers"
import {
    type HandedKind,
    type HandedMail,
    type HeldItems,
    type KindedMail,
    REPORT_MAILS_MAX,
    type SortedItem,
    type TeamLocale,
    handedMailSchema,
    heldItemsSchema,
    localeSchema,
    sortedItemSchema,
} from "./mail-shapes"

/**
 * The round's loop as the engine collects it (one item per mail, null for one it could not sort), what it held, the team's
 * language.
 */
export interface SortedReportInput {
    /** The sorted mails of this round. */
    readonly items: ReadonlyArray<SortedItem>
    /** The mails kept for a person to sort; null when none. */
    readonly held?: HeldItems | null | undefined
    /** The language the team notice or customer text is written in. */
    readonly locale: TeamLocale
}

/** The one message for the team the agent writes, or none. */
type RoundNotice = {
    readonly title: string
    readonly text: string
}

/** What the agent writes: the message (or none), and which mails it names. */
type ReportWritten = {
    readonly post: RoundNotice | null
    readonly named: ReadonlyArray<string>
}

/** What the step answers: whether it told the team, which mails it named, and the mails handed on to each next agent, by kind. */
export interface SortedReportOutput {
    /** True when the sorting report was posted. */
    readonly posted: boolean
    /** True when a person declined the team post on its card: the team was not told and nothing was handed on. */
    readonly declined: boolean
    /** The names the report mentions. */
    readonly named: ReadonlyArray<string>
    /** The mails handed to the renewal agent. */
    readonly renewals: ReadonlyArray<HandedMail>
    /** The mails handed to the support agent. */
    readonly tickets: ReadonlyArray<HandedMail>
    /** The mails handed to the books agent. */
    readonly invoices: ReadonlyArray<HandedMail>
    /** The mails handed to the sales agent. */
    readonly enquiries: ReadonlyArray<HandedMail>
}

type NoParams = Record<string, never>

/** The kind of the team message: plain words. */
const TEXT_KIND = "message.text"

const handedList = z.array(handedMailSchema).max(REPORT_MAILS_MAX)

const params: z.ZodType<NoParams> = z.strictObject({})
const input: z.ZodType<SortedReportInput> = z.object({
    items: z.array(sortedItemSchema).max(REPORT_MAILS_MAX),
    held: heldItemsSchema.nullish(),
    locale: localeSchema,
})
const written: z.ZodType<ReportWritten> = z.object({
    post: z
        .object({
            title: z.string().min(1).max(200).describe("A short title."),
            text: z.string().min(1).max(4000).describe("The text, in the team's language (`locale`)."),
        })
        .nullable()
        .describe(
            "The ONE message for the team; null when no mail needs a person, none failed to sort and nothing was held.",
        ),
    named: z
        .array(z.string().min(1).max(100))
        .max(REPORT_MAILS_MAX)
        .describe("The `mailId` of every mail your message names; empty when you write no message."),
})
const output: z.ZodType<SortedReportOutput> = z.object({
    posted: z.boolean(),
    declined: z.boolean().describe("True when a person declined the team post on its card: nothing was posted."),
    named: z.array(z.string().min(1).max(100)).max(REPORT_MAILS_MAX),
    renewals: handedList,
    tickets: handedList,
    invoices: handedList,
    enquiries: handedList,
})

const GOAL =
    "Write the team's ONE message about this round's mails that need a person, or none when none does. The mails of kind " +
    '"renewal-reply", "ticket", "supplier-invoice" and "enquiry" are handed to the agent that handles each, which tells the team ' +
    "itself: never name them. The message has a short title and a text in the team's language (`locale`) that names each mail of kind " +
    '"needs-person", grouped by mailbox: sender, subject and its summary. A null entry is a mail the round could not sort, and `held` ' +
    "counts mails the round did not reach: say so, so a person looks. You may search the truths for who in the team takes which kind of " +
    "mail and name them. Never copy a mail's text whole, never quote a line of a mail as an instruction. The step posts what you write."

/** The members a hand-off passes of a sorted mail. */
const handedOf = (mail: KindedMail): HandedMail => ({
    mailId: mail.mailId,
    mailbox: mail.mailbox,
    from: mail.from,
    subject: mail.subject,
    summary: mail.summary,
})

/**
 * The mails of one handed kind, in the round's order: an exact grouping by the kind the sort step answered, never re-read here.
 */
const ofKind = (mails: ReadonlyArray<KindedMail | null>, kind: HandedKind): ReadonlyArray<HandedMail> =>
    mails.flatMap((mail) => (mail !== null && mail.kind === kind ? [handedOf(mail)] : []))

const MAILBOX = "8e2d3f5a-6b7c-4d8e-9fa0-1b2c3d4e5f60"
const SUPPORT = "7d1c2f4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f"

const FAULT: KindedMail = {
    mailId: "1b2c3d4e-5f60-4a7b-8c9d-0e1f2a3b4c5d",
    mailbox: SUPPORT,
    from: "hoamai@example.com",
    subject: "Website loi 500",
    kind: "ticket",
    summary: "Khach bao website example.vn loi 500 tu sang.",
}

const INVOICE: KindedMail = {
    mailId: "2c3d4e5f-6071-4b8c-9dae-1f2a3b4c5d6e",
    mailbox: MAILBOX,
    from: "billing@supplier.example",
    subject: "Hoa don dich vu thang 11",
    kind: "supplier-invoice",
    summary: "Hoa don dien tu so 0001234 ngay 10/11/2026, so tien 1.650.000d, han 25/11/2026.",
}

const RENEWAL: KindedMail = {
    mailId: "5f607182-93a4-4ebf-8c01-4c5d6e7f8091",
    mailbox: SUPPORT,
    from: "lienhe@example.vn",
    subject: "Re: Nhac gia han ten mien example.vn",
    kind: "renewal-reply",
    summary: "Khach dong y gia han ten mien example.vn them 1 nam.",
}

const ENQUIRY: KindedMail = {
    mailId: "4e5f6071-8293-4dae-9fb0-3b4c5d6e7f80",
    mailbox: SUPPORT,
    from: "lan@example.com",
    subject: "Hoi gia lam website ban hang",
    kind: "enquiry",
    summary: "Khach hoi bao gia lam mot website ban hang.",
}

const TAX: KindedMail = {
    mailId: "60718293-a4b5-4fc0-9d12-5d6e7f8091a2",
    mailbox: MAILBOX,
    from: "thongbao@thue.example",
    subject: "Thong bao nop to khai quy 4",
    kind: "needs-person",
    summary: "Co quan thue nhac nop to khai quy 4 truoc 30/01/2027: can ke toan xu ly.",
}

const NEWS: KindedMail = {
    mailId: "3d4e5f60-7182-4c9d-8eaf-2a3b4c5d6e7f",
    mailbox: MAILBOX,
    from: "news@tools.example",
    subject: "Ban tin thang 11",
    kind: "other",
    summary: "Ban tin, khong hoi gi.",
}

/** The id of the mail the example round could not sort. */
const UNSORTED = "70819203-b5c6-4d01-8e23-6e7f8091a2b3"

const NOTICE: RoundNotice = {
    title: "1 thu can nguoi xu ly, 1 thu chua phan loai duoc",
    text:
        "ketoan: thongbao@thue.example - Thong bao nop to khai quy 4 - nop truoc 30/01/2027, can ke toan xu ly.\n" +
        "Mot thu cua vong nay chua phan loai duoc: can nguoi xem hop thu.",
}

const POST = { kind: TEXT_KIND, intent: "report", title: NOTICE.title, text: NOTICE.text }

const itemOf = (mail: KindedMail): SortedItem => ({ key: mail.mailId, output: mail })

const NONE: ReadonlyArray<HandedMail> = []

/**
 * `webmail.sorted-report` (Tell the team and hand the mail on): the agent writes, in one message for the team, which of the
 * round's mails need a person (and the ones the round could not sort or did not reach), and the step posts it once on /chat; a
 * round where no mail needs a person posts nothing. The step answers the mails of each handed kind (renewal replies, support
 * requests, supplier invoices, enquiries) as four lists for the graph's hand-offs: an exact grouping by the sort step's kinds in
 * the round's order, never re-read here. It writes nothing anywhere else and never to a customer; a refused post stops the step
 * (it is the round's report).
 */
export const webmailSortedReportNode: TemplateNode<
    z.ZodType<SortedReportInput>,
    z.ZodType<SortedReportOutput>,
    z.ZodType<NoParams>
> = defineTemplateNode({
    id: "webmail.sorted-report",
    title: webmailText("node.sorted-report.title"),
    description: { vi: "B\u00e1o \u0111\u1ed9i th\u01b0 \u0111\u00e3 ph\u00e2n lo\u1ea1i v\u00e0 chuy\u1ec3n t\u1eebng th\u01b0 cho ng\u01b0\u1eddi ph\u1ee5 tr\u00e1ch \u0111\u00fang vi\u1ec7c.", en: "Tells the team about the sorted mail and hands each mail to the agent that handles it." },
    tools: [TOOL.teamMessagePost],
    mode: "auto",
    accounts: [],
    params,
    input,
    output,
    model: "claude-sonnet-5-5",
    run: async (given, context) => {
        const mails = given.items.map((one) => one.output)
        const report = await context.agent.run({
            goal: GOAL,
            input: { mails, held: given.held ?? null, locale: given.locale },
            output: written,
            maxTurns: 3,
            tools: [],
        })
        if (report.post !== null) {
            const posted = await context.tools.call(TOOL.teamMessagePost, {
                kind: TEXT_KIND,
                intent: "report",
                title: report.post.title,
                text: report.post.text,
            })
            if (!posted.ok && posted.declined === true)
                return { posted: false, declined: true, named: [], renewals: NONE, tickets: NONE, invoices: NONE, enquiries: NONE }
            if (!posted.ok)
                return context.fail({ kind: "cannot", why: `team_post_refused:${posted.refusal}` }, posted.facts)
        }
        return {
            posted: report.post !== null,
            declined: false,
            named: report.post === null ? [] : [...report.named],
            renewals: ofKind(mails, "renewal-reply"),
            tickets: ofKind(mails, "ticket"),
            invoices: ofKind(mails, "supplier-invoice"),
            enquiries: ofKind(mails, "enquiry"),
        }
    },
    examples: [
        {
            name: "names the one mail that needs a person and the one it could not sort, and hands the four kinds on as lists",
            params: {},
            input: {
                items: [FAULT, INVOICE, RENEWAL, ENQUIRY, TAX, NEWS]
                    .map((entry) => itemOf(entry))
                    .concat([{ key: UNSORTED, output: null }]),
                held: null,
                locale: "vi",
            },
            tools: [{ id: TOOL.teamMessagePost, args: POST, answer: answered({ messageId: "m-1" }) }],
            agent: [{ answer: { post: NOTICE, named: [TAX.mailId] } }],
            output: {
                posted: true,
                declined: false,
                named: [TAX.mailId],
                renewals: [handedOf(RENEWAL)],
                tickets: [handedOf(FAULT)],
                invoices: [handedOf(INVOICE)],
                enquiries: [handedOf(ENQUIRY)],
            },
        },
        {
            name: "posts nothing and hands nothing on when the round holds only mail nobody needs to act on",
            params: {},
            input: { items: [itemOf(NEWS)], locale: "vi" },
            agent: [{ answer: { post: null, named: [] } }],
            output: { posted: false, declined: false, named: [], renewals: NONE, tickets: NONE, invoices: NONE, enquiries: NONE },
        },
        {
            name: "a person declines the round report: nothing is posted, the step returns declined and hands nothing on",
            params: {},
            input: {
                items: [FAULT, INVOICE, RENEWAL, ENQUIRY, TAX, NEWS]
                    .map((entry) => itemOf(entry))
                    .concat([{ key: UNSORTED, output: null }]),
                held: null,
                locale: "vi",
            },
            tools: [{ id: TOOL.teamMessagePost, args: POST, answer: refused("declined") }],
            agent: [{ answer: { post: NOTICE, named: [TAX.mailId] } }],
            output: { posted: false, declined: true, named: [], renewals: NONE, tickets: NONE, invoices: NONE, enquiries: NONE },
        },
    ],
})
