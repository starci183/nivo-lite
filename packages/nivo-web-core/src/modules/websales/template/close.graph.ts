import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateCatalogue,
    type TemplateGraph,
    callWorkflow,
    defineTemplateGraph,
    node,
    outcome,
    ref,
    trigger,
} from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { websalesAcceptNode } from "../../../nodes/websales/accept.node"
import { websalesCloseFindNode } from "../../../nodes/websales/close-find.node"
import { websalesCloseNotifyNode } from "../../../nodes/websales/close-notify.node"
import { websalesCustomerProposeNode } from "../../../nodes/websales/customer-propose.node"
import { websalesPayInstructNode } from "../../../nodes/websales/pay-instruct.node"
import { DECLINED_END, declinedCheck, declinedEnd, declinedNotice } from "./declined"

/** The language the team reads (version 1's constant param). */
const LOCALE = "vi"

/** The graph's contract: the request the Sales chat turn hands on (`websales.team-route`'s `request`), holding the purchase code. */
const closeInput = z.object({ text: z.string().min(1).max(8000), actorMemberId: z.string().min(1).max(120).nullish() })

/** The accepted purchase, as the pay and the notice steps take it. */
const ACCEPTED = {
    purchaseId: ref("steps.accept.output.purchaseId"),
    purchaseCode: ref("steps.accept.output.purchaseCode"),
    customerCode: ref("steps.accept.output.customerCode"),
    state: ref("steps.accept.output.state"),
    dryRun: ref("steps.accept.output.dryRun"),
    contractNo: ref("steps.accept.output.contractNo"),
    projectCode: ref("steps.accept.output.projectCode", { default: null }),
    serviceCodes: ref("steps.accept.output.serviceCodes"),
    paymentCode: ref("steps.accept.output.paymentCode"),
    firstInstalmentVnd: ref("steps.accept.output.firstInstalmentVnd"),
}

/** What the template catalogue shows of `websales.close` version 4: the texts of version 3, the change note of 4 (rights: one mode per node). */
const CATALOGUE: TemplateCatalogue = {
    name: { vi: "Ch\u1ed1t \u0111\u01a1n m\u1edbi", en: "Close a new sale" },
    summary: {
        vi: "Khi ng\u01b0\u1eddi trong \u0111\u1ed9i nh\u1edd Kinh doanh ch\u1ed1t m\u1ed9t \u0111\u01a1n mua theo m\u00e3 trong chat \u0111\u1ed9i (l\u01b0\u1ee3t tr\u1ea3 l\u1eddi \u0111\u1ed9i chuy\u1ec3n y\u00eau c\u1ea7u sang): t\u00ecm \u0111\u01a1n v\u00e0 kh\u00e1ch trong CRM, x\u00e1c \u0111\u1ecbnh kh\u00e1ch, l\u1eadp h\u1ed3 s\u01a1 mua, b\u00e1o kh\u00e1ch c\u00e1ch thanh to\u00e1n \u0111\u1ee3t 1 (m\u1ecdi b\u01b0\u1edbc t\u1ef1 ch\u1ea1y) r\u1ed3i chuy\u1ec3n H\u1ed3 s\u01a1 so\u1ea1n h\u1ee3p \u0111\u1ed3ng",
        en: "When a person of the team asks Sales in the team chat to close a purchase by its code (the chat turn hands the request on): finds the purchase and the customer in the CRM, settles the customer, records the purchase, tells the customer how to pay the first instalment (every step runs by itself), then hands the contract to Records",
    },
    version: 8,
    // The old JSON template had `seedActive: true`: the seed makes an ACTIVE workflow from it.
    seedActive: true,
    publishedAt: "2026-11-14T04:50:00.000Z",
    notes: {
        vi: "Thời gian gom tin nhắn do khai báo của trigger quyết định, đồ thị không còn tự khai báo",
        en: "How long a burst of messages settles is the trigger declaration's, no longer the graph's",
    },
}
/**
 * `websales.close` version 3 (Chot don moi): a person of the team asks Sales to close a purchase by its code in the team chat, and the
 * chat turn (`websales.team-chat`, its `route` step) hands the request on (a workflow call, the agent's own). `find` finds the
 * purchase by that exact code and the customers it may be, `propose` settles the customer (opening one when none fits),
 * `accept` records the purchase the customer accepted (only while its quote holds), `pay` tells the customer how to pay the first instalment (the reach is the purchase's data), `notify` tells the team and writes the request to Ho so, `to-draft` hands it to Documents'
 * `draft` (the old end hand-off, now a `callWorkflow`), outcome `awaiting-payment`. Declined (a person declined a write or
 * send a shop set to `ask`, a decision): after each blocking step (`propose`, `accept`, `pay`) an `ifNode` `<step>-declined` on its `declined`
 * member goes to that step's notice `<step>-notice` (`team.declined-notice`, the step's own title and the purchase code), then outcome
 * `declined`; the close goes no further. Change from version 1: `pay-ask` is split into
 * `pay` and `notify`; `accept` is a plain call with the quote's exact checks; the hand-off is the graph's own step. Hidden without the
 * CRM, or without both every messaging account and the sending mailbox.
 */
export const closeGraph: TemplateGraph = defineTemplateGraph({
    key: "websales.close",
    title: CATALOGUE.name,
    catalogue: CATALOGUE,
    input: z.object({ data: closeInput }),
    triggers: [trigger(TRIGGER.workflowCalled)],
    openTo: "agent",
    start: "find",
    nodes: {
        find: node(websalesCloseFindNode, { input: { text: ref("trigger.data.text"), locale: LOCALE }, next: "propose" }),
        propose: node(websalesCustomerProposeNode, {
            input: {
                purchaseId: ref("steps.find.output.purchaseId"),
                purchaseCode: ref("steps.find.output.purchaseCode"),
                linked: ref("steps.find.output.linked", { default: null }),
                candidates: ref("steps.find.output.candidates"),
                locale: LOCALE,
            },
            next: "propose-declined",
        }),
        "propose-declined": declinedCheck("propose", "propose-notice", "accept"),
        "propose-notice": declinedNotice("node.customer-propose.title", ref("steps.propose.output.purchaseCode"), DECLINED_END),
        accept: node(websalesAcceptNode, {
            input: {
                purchaseId: ref("steps.propose.output.purchaseId"),
                purchaseCode: ref("steps.propose.output.purchaseCode"),
                // Null only when opening the customer was declined, a branch that never reaches this step.
                customerCode: ref("steps.propose.output.customerCode", { default: null }),
            },
            next: "accept-declined",
        }),
        "accept-declined": declinedCheck("accept", "accept-notice", "pay"),
        "accept-notice": declinedNotice("node.accept.title", ref("steps.propose.output.purchaseCode"), DECLINED_END),
        pay: node(websalesPayInstructNode, { input: Object.assign(Object.assign({}, ACCEPTED), { locale: LOCALE }), next: "pay-declined" }),
        "pay-declined": declinedCheck("pay", "pay-notice", "notify"),
        "pay-notice": declinedNotice("node.pay-instruct.title", ref("steps.pay.output.purchaseCode"), DECLINED_END),
        notify: node(websalesCloseNotifyNode, {
            input: Object.assign(Object.assign({}, ACCEPTED), { by: ref("steps.pay.output.by"), channel: ref("steps.pay.output.channel", { default: null }), locale: LOCALE }),
            next: "to-draft",
        }),
        "to-draft": callWorkflow({
            agent: "webdocs",
            workflow: "draft",
            version: "latest",
            input: {
                text: ref("steps.notify.output.contractRequest"),
                customerCode: ref("steps.notify.output.customerCode"),
                purchaseId: ref("steps.notify.output.purchaseId"),
            },
            next: "awaiting-payment",
        }),
        "awaiting-payment": outcome({
            name: "awaiting-payment",
            output: {
                purchaseId: ref("steps.notify.output.purchaseId"),
                customerCode: ref("steps.notify.output.customerCode"),
                contractRequest: ref("steps.notify.output.contractRequest"),
            },
        }),
        [DECLINED_END]: declinedEnd(),
    },
})
