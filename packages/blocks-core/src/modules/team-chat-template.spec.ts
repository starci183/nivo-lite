import { TOOL } from "../vocabulary/tool-ids"
import { coreNodes } from "../nodes/core-nodes"
import { TEAM_CHAT_GOAL, chatAnswerKeyOf } from "../nodes/team/team-chat.policy"
import { TEAM_CHAT_MODULES, TEAM_CHAT_WORKFLOW_KEY } from "./team-chat-template"
import { latestTemplateVersion, workflowTemplateOf } from "./workflow-templates"

/** What acts on a customer or on money: never offered to a chat turn. */
const ACTS_ON_CUSTOMERS_OR_MONEY: ReadonlyArray<string> = [
    TOOL.customerMessageSend,
    TOOL.careSchedule,
    TOOL.orderRecord,
    TOOL.orderConfirm,
    TOOL.orderVoid,
    TOOL.paymentQrCreate,
    TOOL.paymentMarkPaid,
    TOOL.paymentRematch,
    TOOL.paymentClaimRecord,
    TOOL.ledgerAppend,
    TOOL.ledgerVoid,
    TOOL.bankTransactions,
    TOOL.agentTag,
    TOOL.leadUpdate,
    TOOL.leadStageUpdate,
    TOOL.workItemRaise,
]

describe("the team chat turn of every module with an agent", () => {
    it.each(TEAM_CHAT_MODULES.map((module) => [module] as const))(
        "%s: an active, non-primary template reached only by the router's pin, with one team.chat step",
        (module) => {
            const template = workflowTemplateOf(`${module}.${TEAM_CHAT_WORKFLOW_KEY}`)
            expect(template?.primary).toBe(false)
            expect(template?.seedActive).toBe(true)
            const graph = template === null ? null : latestTemplateVersion(template).graph
            expect(graph?.triggers?.map((trigger) => trigger.source.kind)).toEqual(["workflow"])
            expect(graph?.nodes.map((node) => `${node.key}:${node.step}`)).toEqual(["answer:team.chat"])
            expect(graph?.nodes[0]?.model).toBeDefined()
        },
    )

    it("offers the truth-graph reads and the proposal only: nothing that acts on a customer or on money", () => {
        const node = coreNodes.find((one) => one.id === "team.chat")
        expect(node?.tools).toEqual([TOOL.brainSearch, TOOL.brainFactGet, TOOL.brainFactRelated, TOOL.brainChangePropose])
        expect(node?.effects).toEqual([TOOL.teamMessagePost])
        const offered = [...(node?.tools ?? []), ...(node?.effects ?? [])]
        expect(offered.filter((tool) => ACTS_ON_CUSTOMERS_OR_MONEY.includes(tool))).toEqual([])
    })

    it("carries the truth-change guidance, the rights lens and the no-action rule in its stable goal", () => {
        expect(TEAM_CHAT_GOAL).toContain("brain.change.propose")
        expect(TEAM_CHAT_GOAL).toContain("reason")
        expect(TEAM_CHAT_GOAL).toContain("Không gọi cho: chỉ dẫn một lần")
        expect(TEAM_CHAT_GOAL).toContain("When `standing` is staff")
        expect(TEAM_CHAT_GOAL).toContain("you start no workflow")
        expect(TEAM_CHAT_GOAL).not.toMatch(/\d{4}-\d{2}-\d{2}/u)
    })

    it("keys one answer per message and agent", () => {
        expect(chatAnswerKeyOf("m1", "a1")).toBe("chat-answer:m1:a1")
    })
})
