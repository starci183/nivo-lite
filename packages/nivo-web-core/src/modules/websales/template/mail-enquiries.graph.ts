import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateCatalogue,
    type TemplateGraph,
    defineTemplateGraph,
    equals,
    ifNode,
    loop,
    item,
    node,
    outcome,
    ref,
    trigger,
} from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { websalesMailNotifyNode } from "../../../nodes/websales/mail-notify.node"
import { websalesMailPurchaseOpenNode } from "../../../nodes/websales/mail-purchase-open.node"
import { websalesMailReplyDraftNode } from "../../../nodes/websales/mail-reply-draft.node"
import { websalesMailUnderstandNode } from "../../../nodes/websales/mail-understand.node"
import { websalesQuoteCreateNode } from "../../../nodes/websales/quote-create.node"
import { goesOn, purchaseFact } from "./declined"

/** The language the team reads (version 1's constant param). */
const LOCALE = "vi"

/** The most mails one run handles (version 1's cap); the rest are held, named in the loop's `held`. */
const MAILS_MAX = 25

/** One mail the Mailbox agent hands on. */
const mail = z.object({
    mailId: z.string().min(1).max(100),
    from: z.string().max(400),
    subject: z.string().max(400),
    summary: z.string().min(1).max(600),
    customerCode: z.string().min(1).max(120).nullish(),
})

/** The graph's contract: the mails the Mailbox agent sorted as new purchase enquiries; as version 1. */
const mailEnquiriesInput = z.object({ mails: z.array(mail).min(1).max(50) })

/** The purchase the open step answered for this mail. */
const PURCHASE = {
    purchaseId: ref("steps.open.output.purchaseId"),
    purchaseCode: ref("steps.open.output.purchaseCode"),
}

/** What the template catalogue shows of `websales.mail-enquiries` version 7: the texts of version 2, the change note of 7 (R68). */
const CATALOGUE: TemplateCatalogue = {
    name: { vi: "H\u1ecfi mua qua th\u01b0", en: "Purchase enquiries by mail" },
    summary: {
        vi: "H\u1ed9p th\u01b0 chuy\u1ec3n c\u00e1c th\u01b0 h\u1ecfi mua m\u1edbi: m\u1ed7i th\u01b0 \u0111\u01b0\u1ee3c m\u1edf \u0111\u01a1n mua, CRM b\u00e1o gi\u00e1 khi r\u00f5 nhu c\u1ea7u, so\u1ea1n th\u01b0 tr\u1ea3 l\u1eddi g\u1eedi kh\u00e1ch v\u00e0 b\u00e1o \u0111\u1ed9i; m\u1ed9t th\u01b0 \u0111\u1ed3ng \u00fd kh\u00f4ng t\u1ef1 ch\u1ed1t \u0111\u01a1n",
        en: "The Mailbox agent passes the new purchase enquiries: each mail opens a purchase, the CRM quotes it when the need is clear, a reply mail is drafted, and the team is told; a mailed yes closes nothing",
    },
    version: 7,
    // The old JSON template had `seedActive: true`: the seed makes an ACTIVE workflow from it.
    seedActive: true,
    publishedAt: "2026-11-14T22:00:00.000Z",
    notes: {
        vi: "R68: mở đơn mua hay lập báo giá bị từ chối duyệt thì hệ thống tự báo đội (kèm mã đơn mua khi đã có), thư đó dừng, các thư khác vẫn tiếp tục",
        en: "R68: a declined opening or quote is told to the team by the engine (with the purchase code once there is one); that mail ends, the others go on",
    },
}
/**
 * `websales.mail-enquiries` version 2 (Hoi mua qua thu): the Mailbox agent hands on the mails it sorted as new purchase enquiries. The
 * loop `each` runs, per mail (item key: the mail id), `open` (the purchase keyed by the mail), `understand` (routes `quote` / `ask`),
 * on `quote` the reused `quote` (the CRM's quote; a refusal stops the item), then `draft` (the reply, a side step through the sending
 * mailbox) and `notify` (the team line, a side step). The loop COLLECTS `understand`: the one body step every route reaches that is not
 * a side step, so every mail's purchase and route are in the loop's output even when the mailbox is not attached. Unsuccessful (a person
 * declined opening the purchase or the quote, a decision, or the step's `cannot`): `open` and `quote` declare their `unsuccessful`
 * ending (R68): the ENGINE tells the team (the step, the reason, the purchase code once there is one); the business checks `opened` /
 * `quoted` let only a real purchase / quote go on, so that mail's ITEM ends there (its collected `understand` is null); the other mails
 * go on. Change from version 6: the declined notices are gone (the engine reports). Change from version 1:
 * `websales.mail-intake` is split into five steps; the reply is `nivo.tool.mail.message.send` instead of a `send_email` work item.
 * Hidden without the CRM.
 */
export const mailEnquiriesGraph: TemplateGraph = defineTemplateGraph({
    key: "websales.mail-enquiries",
    title: CATALOGUE.name,
    catalogue: CATALOGUE,
    input: z.object({ data: mailEnquiriesInput }),
    triggers: [trigger(TRIGGER.workflowCalled)],
    openTo: "any",
    start: "each",
    nodes: {
        each: loop({
            label: { vi: "Từng thư hỏi mua", en: "Each enquiry mail" },
            over: ref("trigger.data.mails"),
            key: "mailId",
            concurrency: 1,
            max: MAILS_MAX,
            body: {
                start: "open",
                nodes: {
                    open: node(websalesMailPurchaseOpenNode, {
                        input: {
                            mailId: item("mailId"),
                            from: item("from"),
                            subject: item("subject"),
                            summary: item("summary"),
                            customerCode: item("customerCode"),
                            locale: LOCALE,
                        },
                        next: "opened",
                        // No purchase was opened: the notice names no record.
                        unsuccessful: goesOn([]),
                    }),
                    // Only a purchase really opened goes on (a declined or failed opening ends the mail's ITEM: no `no`).
                    opened: ifNode({
                        label: { vi: "Đã ghi nhận thư hỏi mua?", en: "Enquiry recorded?" },
                        when: equals(ref("steps.open.output.declined"), false),
                        yes: "understand",
                    }),
                    understand: node(websalesMailUnderstandNode, {
                        input: Object.assign(Object.assign({}, PURCHASE), { mailId: item("mailId"), subject: item("subject"), summary: item("summary"), locale: LOCALE }),
                        routes: { quote: "quote", ask: "draft" },
                    }),
                    quote: node(websalesQuoteCreateNode, {
                        input: Object.assign(Object.assign({}, PURCHASE), { items: ref("steps.understand.output.items") }),
                        next: "quoted",
                        unsuccessful: goesOn([purchaseFact(ref("steps.open.output.purchaseCode"))]),
                    }),
                    // Only a quote the CRM really made goes on to the reply (a declined or failed quote ends the ITEM: no `no`).
                    quoted: ifNode({
                        label: { vi: "Đã lập báo giá?", en: "Quote made?" },
                        when: equals(ref("steps.quote.output.declined"), false),
                        yes: "draft",
                    }),
                    // `quote` did not run on the ask route: its ref defaults to null (ADDENDUM 1 C6).
                    draft: node(websalesMailReplyDraftNode, {
                        input: Object.assign(Object.assign({}, PURCHASE), { mailId: item("mailId"), from: item("from"), subject: item("subject"), summary: item("summary"), quote: ref("steps.quote.output.quote", { default: null }), locale: LOCALE }),
                        next: "notify",
                    }),
                    // `draft` is a side step, skipped with no sending mailbox: its output is null, so the ref defaults to null (ADDENDUM 1 C6).
                    notify: node(websalesMailNotifyNode, {
                        input: {
                            from: item("from"),
                            summary: item("summary"),
                            purchaseCode: ref("steps.open.output.purchaseCode"),
                            branch: ref("steps.understand.output.branch"),
                            drafted: ref("steps.draft.output.drafted", { default: null }),
                            locale: LOCALE,
                        },
                    }),
                },
                collect: "understand",
            },
            next: "recorded",
        }),
        recorded: outcome({ name: "recorded", label: { vi: "Đã ghi nhận các thư", en: "Recorded" } }),
    },
})
