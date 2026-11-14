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
import { teamAnswerPostNode } from "@nivo-lite/blocks-core"
import { z } from "zod"
import { LINES_MAX, REQUEST_MAX, askerSchema, localeSchema, roomLineSchema } from "../../../nodes/webdocs/doc-shapes"
import { webdocsDraftNode } from "../../../nodes/webdocs/draft.node"
import { webdocsReadNode } from "../../../nodes/webdocs/read.node"

/** The key of the Paperwork agent's chat turn with the team. */
export const WEBDOCS_TEAM_CHAT_KEY = "webdocs.team-chat"

/** The graph's contract: what the team-chat router supplies through its workflow call (`replyTo` alone may be absent). */
const teamChatInput = z.object({
    roomId: z.string().min(1).max(200),
    messageId: z.string().min(1).max(200),
    text: z.string().min(1).max(REQUEST_MAX),
    room: z.enum(["direct", "common"]),
    intent: z.enum(["answer", "capture"]),
    asker: askerSchema,
    lines: z.array(roomLineSchema).max(LINES_MAX),
    replyTo: roomLineSchema.nullish(),
    locale: localeSchema,
})

/** What the template catalogue shows of version 7: the texts of version 6, the change note of 7 (a declined answer post ends the turn `declined`). */
const CATALOGUE: TemplateCatalogue = {
    name: { vi: "Tr\u1ea3 l\u1eddi \u0111\u1ed9i", en: "Answer the team" },
    summary: {
        vi: "Khi ng\u01b0\u1eddi trong \u0111\u1ed9i nh\u1eafn trong chat ri\u00eang ho\u1eb7c g\u1ecdi t\u00ean trong ph\u00f2ng chung: \u0111\u1ecdc t\u00e0i li\u1ec7u v\u00e0 h\u1ed3 s\u01a1 kh\u00e1ch li\u00ean quan, so\u1ea1n b\u1ea3n nh\u00e1p k\u00e8m ngu\u1ed3n v\u00e0 tr\u1ea3 l\u1eddi ngay d\u01b0\u1edbi tin nh\u1eafn \u0111\u1ec3 ng\u01b0\u1eddi \u0111\u00f3 xem v\u00e0 k\u00fd tay",
        en: "When a person of the team writes in the private chat or calls it by name in a shared room: reads the relevant documents and customer records, drafts with the sources and replies under the message for that person to check and sign by hand",
    },
    version: 8,
    // The old JSON template had `seedActive: true`: the seed makes an ACTIVE workflow from it.
    seedActive: true,
    publishedAt: "2026-11-14T04:15:00.000Z",
    notes: {
        vi: "Nhận tham số của bước gọi trong dữ liệu của sự kiện (trigger.data)",
        en: "Takes its caller's params in the event's data (trigger.data)",
    },
}

/**
 * `webdocs.team-chat` version 6 ("Answer the team"): a person of the team asks the Paperwork agent in /chat; read what the draft needs
 * (`read`), write the draft (`draft`), reply under the person's message (`post`, blocks-core `team.answer-post`), `drafted`; a reply a
 * person declined on its card ends `declined` (`post-declined`, no team notice: the person who declined is the team). Change from
 * version 5: the `post-declined` check and the `declined` outcome. Change from version 4: the draft step writes the text only; the reply is the shared post step (once per message and agent: the tool's key).
 */
export const webdocsTeamChatGraph: TemplateGraph = defineTemplateGraph({
    key: WEBDOCS_TEAM_CHAT_KEY,
    title: CATALOGUE.name,
    catalogue: CATALOGUE,
    input: z.object({ data: teamChatInput }),
    triggers: [trigger(TRIGGER.workflowCalled)],
    openTo: "any",
    start: "read",
    nodes: {
        read: node(webdocsReadNode, {
            input: {
                text: ref("trigger.data.text"),
                lines: ref("trigger.data.lines"),
                replyTo: ref("trigger.data.replyTo"),
                locale: ref("trigger.data.locale"),
            },
            next: "draft",
        }),
        draft: node(webdocsDraftNode, {
            input: {
                text: ref("trigger.data.text"),
                asker: ref("trigger.data.asker"),
                customerCode: ref("steps.read.output.customerCode"),
                purchase: ref("steps.read.output.purchase"),
                sources: ref("steps.read.output.sources"),
                facts: ref("steps.read.output.facts"),
                locale: ref("trigger.data.locale"),
            },
            next: "post",
        }),
        post: node(teamAnswerPostNode, {
            input: { messageId: ref("trigger.data.messageId"), answer: ref("steps.draft.output.answer") },
            next: "post-declined",
        }),
        "post-declined": ifNode({ when: equals(ref("steps.post.output.declined"), true), yes: "declined", no: "drafted" }),
        drafted: outcome({ name: "drafted" }),
        declined: outcome({ name: "declined" }),
    },
})
