import { TRIGGER } from "@nivo-lite/agent-sdk/names"
import {
    type TemplateCatalogue,
    type TemplateGraph,
    defineTemplateGraph,
    equals,
    ifNode,
    node,
    outcome,
    ref,
    trigger,
} from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { REQUEST_MAX } from "../../../nodes/webdocs/doc-shapes"
import { webdocsDraftPostNode } from "../../../nodes/webdocs/draft-post.node"
import { webdocsDraftNode } from "../../../nodes/webdocs/draft.node"
import { webdocsReadNode } from "../../../nodes/webdocs/read.node"

/** The key of the Paperwork agent's draft workflow. */
export const WEBDOCS_DRAFT_KEY = "webdocs.draft"

/** The graph's contract: the request, and optionally the customer and the purchase (the Sales agent's close); never a conversation. */
const draftInput = z.object({
    text: z.string().min(1).max(REQUEST_MAX),
    customerCode: z.string().min(1).max(60).nullish(),
    purchaseId: z.string().min(1).max(120).nullish(),
})

/** What the template catalogue shows of version 6: the texts of version 5, the change note of 6 (rights: one mode per node). */
const CATALOGUE: TemplateCatalogue = {
    name: { vi: "So\u1ea1n h\u1ed3 s\u01a1", en: "Draft paperwork" },
    summary: {
        vi: "Nh\u1eadn m\u1ed9t y\u00eau c\u1ea7u so\u1ea1n gi\u1ea5y t\u1edd, t\u00ecm t\u00e0i li\u1ec7u trong Second Brain v\u00e0 h\u1ed3 s\u01a1 kh\u00e1ch trong CRM, so\u1ea1n b\u1ea3n nh\u00e1p k\u00e8m ngu\u1ed3n v\u00e0 g\u1eedi l\u1ea1i \u0111\u1ed9i \u0111\u1ec3 ng\u01b0\u1eddi xem v\u00e0 k\u00fd tay",
        en: "Takes a request for paperwork, finds the documents in the Second Brain and the customer records in the CRM, drafts with the sources and hands the draft to the team to check and sign by hand",
    },
    version: 9,
    publishedAt: "2026-11-14T22:00:00.000Z",
    notes: {
        vi: "R68: các bước điều kiện và kết quả mang tên theo lời của workspace; nghiệp vụ không đổi",
        en: "R68: the conditions and the outcomes carry the workspace's words; the business is unchanged",
    },
}

/**
 * `webdocs.draft` version 5 ("Draft paperwork"): a workflow hands over a request for paperwork; read the documents, truths and CRM
 * records it needs (`read`), write the draft (`draft`), hand it to the team (`post`, `webdocs.draft-post`), `drafted`. Change from
 * version 4: the draft step writes the text only and the post is its own step. No `ifNode` on `messageId`: this graph's contract has no
 * message to reply to (the team-chat graph always has one), so each graph wires its own post. Change from version 6: `post` declined
 * (`post-declined`, an exact boolean) -> outcome `declined` (the declined write is itself a team post, so no notice).
 */
export const webdocsDraftGraph: TemplateGraph = defineTemplateGraph({
    key: WEBDOCS_DRAFT_KEY,
    title: CATALOGUE.name,
    catalogue: CATALOGUE,
    input: z.object({ data: draftInput }),
    triggers: [trigger(TRIGGER.workflowCalled)],
    openTo: "any",
    start: "read",
    nodes: {
        read: node(webdocsReadNode, {
            input: {
                text: ref("trigger.data.text"),
                customerCode: ref("trigger.data.customerCode"),
                purchaseId: ref("trigger.data.purchaseId"),
                locale: "vi",
            },
            next: "draft",
        }),
        draft: node(webdocsDraftNode, {
            input: {
                text: ref("trigger.data.text"),
                customerCode: ref("steps.read.output.customerCode"),
                purchaseId: ref("trigger.data.purchaseId"),
                purchase: ref("steps.read.output.purchase"),
                sources: ref("steps.read.output.sources"),
                facts: ref("steps.read.output.facts"),
                locale: "vi",
            },
            next: "post",
        }),
        post: node(webdocsDraftPostNode, {
            input: { title: ref("steps.draft.output.title"), answer: ref("steps.draft.output.answer") },
            next: "post-declined",
        }),
        "post-declined": ifNode({
            label: { vi: "Bị từ chối đăng bản nháp?", en: "Draft post declined?" },
            when: equals(ref("steps.post.output.declined"), true),
            yes: "declined",
            no: "drafted",
        }),
        drafted: outcome({ name: "drafted", label: { vi: "Đã soạn", en: "Drafted" } }),
        declined: outcome({ name: "declined", label: { vi: "Bị từ chối", en: "Declined" } }),
    },
})
