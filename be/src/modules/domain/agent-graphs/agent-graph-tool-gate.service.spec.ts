import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { GraphAnswer } from "@modules/domain/authority-rules"
import type { ToolGraphCall } from "@modules/domain/mcp-gateway"
import { stateOf } from "@tests/fixtures/builders/agent-graph.builder"
import { AgentGraphChecksService } from "./agent-graph-checks.service"
import { AgentGraphToolGateService } from "./agent-graph-tool-gate.service"
import { AgentGraphsService } from "./agent-graphs.service"
import type { OptionalGraphState } from "./agent-graphs.service"

const CALL: ToolGraphCall = {
    workspaceId: "ws-1",
    agentId: "agent-1",
    conversationId: "conv-1",
    key: "item-1",
    name: "gmail.send",
    turnId: "turn-1",
}

const answer = (outcome: GraphAnswer["outcome"]): GraphAnswer => ({ outcome, unread: [], unjudged: null, divert: null })

const build = async (
    state: OptionalGraphState = stateOf({ mode: "enforced" }),
    outcome: GraphAnswer["outcome"] = "run",
) => {
    const graphs = mock<AgentGraphsService>({ stateOfAgent: jest.fn().mockResolvedValue(state) })
    const checks = mock<AgentGraphChecksService>({ check: jest.fn().mockResolvedValue(answer(outcome)) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphToolGateService,
            { provide: AgentGraphsService, useValue: graphs },
            { provide: AgentGraphChecksService, useValue: checks },
        ],
    }).compile()
    return { gate: moduleRef.get(AgentGraphToolGateService), graphs, checks }
}

describe("AgentGraphToolGateService.judge", () => {
    it("lets a call run for an agent with no graph, and asks the checks nothing", async () => {
        const { gate, graphs, checks } = await build(null)

        await expect(gate.judge(CALL)).resolves.toEqual({ kind: "run" })

        expect(graphs.stateOfAgent).toHaveBeenCalledWith("ws-1", "agent-1")
        expect(checks.check).not.toHaveBeenCalled()
    })

    it("asks the graph about the call on the tool road, under the action of gateway calls, and opens work when it serves a conversation", async () => {
        const { gate, checks } = await build()

        await gate.judge(CALL)

        expect(checks.check).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            installationId: "inst-1",
            action: "gateway_call",
            road: "tool",
            key: "agent-1:item-1:gmail.send",
            subjectType: "conversation",
            subjectId: "conv-1",
            leadId: null,
            text: null,
            money: null,
            attributes: { "tool.name": "gmail.send", "tool.connector": "gmail" },
            turnId: "turn-1",
            wakeId: null,
            askOpensWork: true,
        })
    })

    it("names a call that serves no conversation as a tool call, which opens no work, and a tool with no dot as its own connector", async () => {
        const { gate, checks } = await build()

        await gate.judge({ ...CALL, conversationId: null, name: "ping", turnId: null })

        expect(checks.check).toHaveBeenCalledWith(
            expect.objectContaining({
                subjectType: "tool",
                subjectId: null,
                attributes: { "tool.name": "ping", "tool.connector": "ping" },
                turnId: null,
                askOpensWork: false,
            }),
        )
    })

    it.each([
        ["run", { kind: "run" }],
        ["ask", { kind: "ask" }],
        ["stop", { kind: "stop" }],
        ["divert", { kind: "stop" }],
    ] as const)(
        "turns the answer %s of the graph into the verdict %j, a tool having no work item to hand on",
        async (outcome, verdict) => {
            const { gate } = await build(stateOf({ mode: "enforced" }), outcome)

            await expect(gate.judge(CALL)).resolves.toEqual(verdict)
        },
    )
})
