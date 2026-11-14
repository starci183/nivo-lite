import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { AgentViewScopeService } from "@modules/domain/agents"
import { GraphNodeRunTokensService } from "@modules/domain/graph-nodes"
import type { NodeRunClaims } from "@modules/domain/graph-nodes"
import { PassageRetrievalService } from "@modules/domain/knowledge"
import type { PassageFound } from "@modules/domain/knowledge"
import { ToolRegistryService, NodeToolDoorService } from "@modules/domain/tools"
import type { ToolCaller } from "@modules/domain/tools"
import { NativeRunnerService } from "@modules/domain/tools/native-runner.service"
import { WorkspaceMembersReadService } from "@modules/domain/workspace-members"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { QUEUE_TIMEOUT } from "@modules/platform/queue"
import type { QueueTimeout } from "@modules/platform/queue"
import { NativeViewService } from "./native-view.service"
import { PassageNativeService } from "./passage-native.service"
import {
    DELIVERY_POLICY_TITLE_VI,
    FEE_UNDER_300K_VI,
    INNER_CITY_FEE_QUERY_VI,
} from "@tests/fixtures/i18n/native-tools-spec.messages"

// A graph step's document read goes out with the view of its run: the consult step of a customer's conversation reaches the
// passage store in the customer lens (released public passages only), the team's own run in the internal lens. Walked from the node
// door (the run token) through the native runner to the real passage service; only the token, the agent's scope, the gateway's
// routing and the store are faked.

const WS = "11111111-1111-4111-8111-111111111111"
const PASSAGE = "7f0c2b1e-3a4d-4c5e-8f60-112233445566"
const DOCUMENT = "b21e9d4c-5f6a-4b7c-9d8e-665544332211"

/** The claims of a consult step answering a customer: a customer-started run of the Sales agent, in the customer's conversation. */
const CUSTOMER_RUN: NodeRunClaims = {
    workspaceId: WS,
    agentId: "agent-sales",
    runId: "run-1",
    conversationId: "conv-1",
    origin: "customer",
    memberId: null,
    scope: "public",
    expiresAt: 9_999_999_999_999,
}

/** The claims of the same agent's run for the team: no conversation, the workspace's scope. */
const TEAM_RUN: NodeRunClaims = { ...CUSTOMER_RUN, conversationId: null, origin: "system", scope: "workspace" }

const hit: PassageFound = {
    id: PASSAGE,
    sourceId: DOCUMENT,
    title: DELIVERY_POLICY_TITLE_VI,
    updatedAt: "2026-11-02T03:15:00.000Z",
    documentPassages: 48,
    order: 12,
    place: null,
    module: null,
    visibility: "public",
    customerReady: true,
    legs: ["words"],
    score: 1,
    content: FEE_UNDER_300K_VI,
}

const build = async (claims: NodeRunClaims, module = "sales") => {
    const tokens = mock<GraphNodeRunTokensService>()
    tokens.verify.mockReturnValue(claims)
    const scopes = mock<AgentViewScopeService>()
    scopes.lensOf.mockResolvedValue({ module, installationId: null })
    const retrieval = mock<PassageRetrievalService>()
    retrieval.search.mockResolvedValue({ legs: ["words"], hits: [hit], next: null })
    const timeout = mock<QueueTimeout>()
    timeout.schedule.mockReturnValue(() => undefined)
    const gateway = mock<ToolRegistryService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            NodeToolDoorService,
            NativeRunnerService,
            NativeViewService,
            PassageNativeService,
            { provide: GraphNodeRunTokensService, useValue: tokens },
            { provide: ToolRegistryService, useValue: gateway },
            { provide: AgentViewScopeService, useValue: scopes },
            { provide: PassageRetrievalService, useValue: retrieval },
            { provide: WorkspaceMembersReadService, useValue: mock<WorkspaceMembersReadService>() },
            { provide: QUEUE_TIMEOUT, useValue: timeout },
            { provide: LOGGER, useValue: mock<Logger>() },
        ],
    }).compile()
    const runner = moduleRef.get(NativeRunnerService)
    const passages = moduleRef.get(PassageNativeService)
    // The gateway's routing of a `nivo.tool.brain.passage.*` name to its native adapter, under the connector's time limit.
    gateway.call.mockImplementation(async (caller: ToolCaller, tool: string, args) => {
        const run = await runner.run(passages, caller, tool.replace("nivo.tool.brain.", ""), 5000, args)
        return { ok: true, value: run.value }
    })
    return { door: moduleRef.get(NodeToolDoorService), gateway, retrieval }
}

const searchOf = (door: NodeToolDoorService) =>
    door.call({
        token: "token-1",
        tool: TOOL.brainPassageSearch,
        args: { query: INNER_CITY_FEE_QUERY_VI },
        key: "step-1",
        approval: null,
    })

describe("a graph step's document read carries the view of its run", () => {
    it("searches for the consult step of a customer's conversation in the customer lens, and answers no count and no release mark", async () => {
        const { door, gateway, retrieval } = await build(CUSTOMER_RUN)

        const answer = await searchOf(door)

        // The Sales agent is an internal module, so the caller's audience stays its own; the conversation narrows the view.
        expect(gateway.call.mock.calls[0]?.[0]).toMatchObject({ conversationId: "conv-1", graphStep: true })
        expect(retrieval.search.mock.calls[0]?.[0]).toEqual({
            workspaceId: WS,
            module: "sales",
            audience: "customer",
            installationId: null,
        })
        expect(answer).toMatchObject({ hits: [{ id: PASSAGE, doc: DOCUMENT, at: 12, updated: "2026-11-02" }] })
        expect(JSON.stringify(answer)).not.toMatch(/"of"|"ready"/u)
    })

    it("searches for the front desk (a customer-facing agent) as the customer, in the customer lens", async () => {
        const { door, gateway, retrieval } = await build(CUSTOMER_RUN, "chatbot")

        await searchOf(door)

        expect(gateway.call.mock.calls[0]?.[0]).toMatchObject({ conversationId: "conv-1", audience: "customer" })
        expect(retrieval.search.mock.calls[0]?.[0]).toMatchObject({ module: "chatbot", audience: "customer" })
    })

    it("searches for the same agent's run for the team in the internal lens", async () => {
        const { door, retrieval } = await build(TEAM_RUN)

        const answer = await searchOf(door)

        expect(retrieval.search.mock.calls[0]?.[0]).toMatchObject({ audience: "internal" })
        expect(answer).toMatchObject({ hits: [{ of: 48, ready: true }] })
    })
})
