import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateCatalogue,
    type TemplateGraph,
    defineTemplateGraph,
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
import { declinedCheck, declinedNotice } from "./declined"

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

/** What the template catalogue shows of `websales.mail-enquiries` version 3: the texts of version 2, the change note of 3 (rights: one mode per node). */
const CATALOGUE: TemplateCatalogue = {
    name: { vi: "H\u1ecfi mua qua th\u01b0", en: "Purchase enquiries by mail" },
    summary: {
        vi: "H\u1ed9p th\u01b0 chuy\u1ec3n c\u00e1c th\u01b0 h\u1ecfi mua m\u1edbi: m\u1ed7i th\u01b0 \u0111\u01b0\u1ee3c m\u1edf \u0111\u01a1n mua, CRM b\u00e1o gi\u00e1 khi r\u00f5 nhu c\u1ea7u, so\u1ea1n th\u01b0 tr\u1ea3 l\u1eddi g\u1eedi kh\u00e1ch v\u00e0 b\u00e1o \u0111\u1ed9i; m\u1ed9t th\u01b0 \u0111\u1ed3ng \u00fd kh\u00f4ng t\u1ef1 ch\u1ed1t \u0111\u01a1n",
        en: "The Mailbox agent passes the new purchase enquiries: each mail opens a purchase, the CRM quotes it when the need is clear, a reply mail is drafted, and the team is told; a mailed yes closes nothing",
    },
    version: 6,
    // The old JSON template had `seedActive: true`: the seed makes an ACTIVE workflow from it.
    seedActive: true,
    publishedAt: "2026-11-14T04:50:00.000Z",
    notes: {
        vi: "Thời gian gom tin nhắn do khai báo của trigger quyết định, đồ thị không còn tự khai báo",
        en: "How long a burst of messages settles is the trigger declaration's, no longer the graph's",
    },
}
/**
 * `websales.mail-enquiries` version 2 (Hoi mua qua thu): the Mailbox agent hands on the mails it sorted as new purchase enquiries. The
 * loop `each` runs, per mail (item key: the mail id), `open` (the purchase keyed by the mail), `understand` (routes `quote` / `ask`),
 * on `quote` the reused `quote` (the CRM's quote; a refusal stops the item), then `draft` (the reply, a side step through the sending
 * mailbox) and `notify` (the team line, a side step). The loop COLLECTS `understand`: the one body step every route reaches that is not
 * a side step, so every mail's purchase and route are in the loop's output even when the mailbox is not attached. Declined (a person
 * declined opening the purchase or the quote, a decision): `open-declined` / `quote-declined` (an `ifNode` on the step's `declined`
 * member) go to that step's notice (`team.declined-notice`, the step's title and the purchase code, none when no purchase was opened),
 * and that mail's ITEM ends there (its collected `understand` is null); the other mails go on. Change from version 1:
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
                        next: "open-declined",
                    }),
                    // No purchase was opened: the notice names no record.
                    "open-declined": declinedCheck("open", "open-notice", "understand"),
                    "open-notice": declinedNotice("node.mail-purchase-open.title", null),
                    understand: node(websalesMailUnderstandNode, {
                        input: Object.assign(Object.assign({}, PURCHASE), { mailId: item("mailId"), subject: item("subject"), summary: item("summary"), locale: LOCALE }),
                        routes: { quote: "quote", ask: "draft" },
                    }),
                    quote: node(websalesQuoteCreateNode, {
                        input: Object.assign(Object.assign({}, PURCHASE), { items: ref("steps.understand.output.items") }),
                        next: "quote-declined",
                    }),
                    "quote-declined": declinedCheck("quote", "quote-notice", "draft"),
                    "quote-notice": declinedNotice("node.quote-create.title", ref("steps.quote.output.purchaseCode")),
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
        recorded: outcome({ name: "recorded" }),
    },
})
