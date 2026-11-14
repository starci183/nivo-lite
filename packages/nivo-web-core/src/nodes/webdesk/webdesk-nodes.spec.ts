import type { AnyTemplateNode } from "@nivo-lite/agent-sdk/template"
import { checkTemplateNode } from "@nivo-lite/agent-sdk/testing"
import { webdeskAnswerPlanNode } from "./answer-plan.node"
import { webdeskCheckNode } from "./check.node"
import { webdeskContactLinkNode } from "./contact-link.node"
import { webdeskCustomerReplyNode } from "./customer-reply.node"
import { webdeskIdentifyNode } from "./identify.node"
import { webdeskIntakeLinkedNode } from "./intake-linked.node"
import { webdeskMailReplyDraftNode } from "./mail-reply-draft.node"
import { webdeskPlanNode } from "./plan.node"
import { webdeskTeamTellNode } from "./team-tell.node"
import { webdeskTicketNoteNode } from "./ticket-note.node"
import { webdeskTicketOpenNode } from "./ticket-open.node"
import { webdeskUnderstandSalesNode } from "./understand-sales.node"
import { webdeskNodes } from "./webdesk-nodes"

/** The Support steps of this slice (`webdesk.team-answer` is the team-answer slice's, checked by its own spec). */
const STEPS: ReadonlyArray<AnyTemplateNode> = [
    webdeskUnderstandSalesNode,
    webdeskIdentifyNode,
    webdeskTicketOpenNode,
    webdeskContactLinkNode,
    webdeskIntakeLinkedNode,
    webdeskCheckNode,
    webdeskPlanNode,
    webdeskAnswerPlanNode,
    webdeskTeamTellNode,
    webdeskCustomerReplyNode,
    webdeskTicketNoteNode,
    webdeskMailReplyDraftNode,
]

/** The steps that only call tools: no AI call, so no `model`. */
const NO_AI: ReadonlyArray<string> = [
    "webdesk.contact-link",
    "webdesk.team-tell",
    "webdesk.customer-reply",
    "webdesk.ticket-note",
    "webdesk.mail-reply-draft",
]

describe("the steps of the Support agent", () => {
    it.each(STEPS.map((node) => [node.id, node] as const))(
        "%s conforms: its definition and every example hold",
        async (_id, node) => {
            expect(await checkTemplateNode(node)).toEqual([])
        },
    )

    it("lists every step for the registry, the team answer last", () => {
        expect(webdeskNodes.map((node) => node.id)).toEqual([...STEPS.map((node) => node.id), "webdesk.team-answer"])
    })

    it("declares a model only on the steps that call the AI", () => {
        for (const node of STEPS)
            expect([node.id, node.model === undefined]).toEqual([node.id, NO_AI.includes(node.id)])
    })

    it("keeps the link of an address and the mail reply draft as side steps", () => {
        expect(STEPS.filter((node) => node.blocking === false).map((node) => node.id)).toEqual([
            "webdesk.contact-link",
            "webdesk.mail-reply-draft",
        ])
    })
})
