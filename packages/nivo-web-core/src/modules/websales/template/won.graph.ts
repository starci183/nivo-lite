import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateCatalogue,
    type TemplateGraph,
    defineTemplateGraph,
    node,
    outcome,
    ref,
    trigger,
} from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { websalesHandoverNotifyNode } from "../../../nodes/websales/handover-notify.node"
import { websalesPaidMailNode, websalesPaidTellNode } from "../../../nodes/websales/paid-tell.node"
import { websalesPaidToldNode } from "../../../nodes/websales/paid-told.node"

/** The language the team reads (version 1's constant param). */
const LOCALE = "vi"

/** The graph's contract: what Accounting supplies once the bank proved the first instalment; as version 1. */
const wonInput = z.object({
    purchaseId: z.string().min(1).max(120),
    customerCode: z.string().min(1).max(120),
    transactionRef: z.string().min(1).max(200),
})

/** What both steps take. */
const WON = {
    purchaseId: ref("trigger.data.purchaseId"),
    customerCode: ref("trigger.data.customerCode"),
    transactionRef: ref("trigger.data.transactionRef"),
    locale: LOCALE,
}

/** What the template catalogue shows of `websales.won` version 9: the texts of version 2, the change note of 9 (rights: one mode per node). */
const CATALOGUE: TemplateCatalogue = {
    name: { vi: "B\u00e1o \u0111\u00e3 nh\u1eadn ti\u1ec1n, giao vi\u1ec7c tri\u1ec3n khai", en: "Payment received, hand the work over" },
    summary: {
        vi: "K\u1ebf to\u00e1n b\u00e1o kh\u00e1ch \u0111\u00e3 tr\u1ea3 \u0111\u1ee3t \u0111\u1ea7u c\u1ee7a \u0111\u01a1n mua m\u1edbi: giao \u0111\u1ed9i vi\u1ec7c \u0111\u0103ng k\u00fd, hosting, l\u00e0m web ngay, r\u1ed3i b\u00e1o kh\u00e1ch (nh\u1eafn kh\u00e1ch, ho\u1eb7c so\u1ea1n th\u01b0 \u0111\u1ec3 ng\u01b0\u1eddi g\u1eedi); agent kh\u00f4ng t\u1ef1 tri\u1ec3n khai g\u00ec",
        en: "Accounting says a new purchase's first instalment arrived: hands the team the registering, hosting and building at once, then tells the customer (a message, or a mail draft a person sends); the agent provisions nothing",
    },
    version: 9,
    // The old JSON template had `seedActive: true`: the seed makes an ACTIVE workflow from it.
    seedActive: true,
    publishedAt: "2026-11-14T22:00:00.000Z",
    notes: {
        vi: "R68: kết quả mang nhãn theo lời của cửa hàng; các bước kinh doanh không đổi. Bước báo khách tách theo kênh (cuộc trò chuyện, thư): mỗi bước chỉ một lần gửi",
        en: "R68: the outcome carries its label in the workspace's words; the business steps are unchanged. Telling the customer is split by channel (conversation, mail): each step makes ONE send",
    },
}
/**
 * `websales.won` version 2 (Bao da nhan tien, giao viec trien khai): Accounting calls it once the bank proved a new purchase's first
 * instalment. `handover` hands the team the work order FIRST (the graph's purpose, blocking): the team's work must not wait behind the customer's thank-you; `tell` then tells the customer (a side step: with
 * no way to reach them only it stops), outcome `won`. Change from version 1: `websales.handover` is split into the work order and the
 * customer line, in that order.
 * Change from version 8 (ask ONE write): the send is split by channel: `tell` (conversation), `tell-mail` (mail), then `told` merges the two.
 * Hidden without the CRM.
 */
export const wonGraph: TemplateGraph = defineTemplateGraph({
    key: "websales.won",
    title: CATALOGUE.name,
    catalogue: CATALOGUE,
    input: z.object({ data: wonInput }),
    triggers: [trigger(TRIGGER.workflowCalled)],
    openTo: "any",
    start: "handover",
    nodes: {
        handover: node(websalesHandoverNotifyNode, { input: WON, next: "tell" }),
        tell: node(websalesPaidTellNode, { input: WON, next: "tell-mail" }),
        "tell-mail": node(websalesPaidMailNode, { input: WON, next: "told" }),
        told: node(websalesPaidToldNode, {
            input: {
                chat: ref("steps.tell.output", { default: null }),
                mail: ref("steps.tell-mail.output", { default: null }),
            },
            next: "won",
        }),
        won: outcome({
            name: "won",
            label: { vi: "Đã giao việc triển khai", en: "Work handed over" },
            output: {
                purchaseId: ref("steps.handover.output.purchaseId"),
                customerCode: ref("steps.handover.output.customerCode"),
            },
        }),
    },
})
