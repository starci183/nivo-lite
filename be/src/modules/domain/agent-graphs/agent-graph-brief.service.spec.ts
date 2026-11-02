import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { nodeOf, stateOf } from "@tests/fixtures/builders/agent-graph.builder"
import { AgentGraphBriefService } from "./agent-graph-brief.service"
import { AgentGraphContractsService } from "./agent-graph-contracts.service"
import { AgentGraphProposalsService } from "./agent-graph-proposals.service"
import { AgentGraphsService } from "./agent-graphs.service"
import type { GraphState } from "./agent-graphs.service"

const build = async (state: GraphState | null) => {
    const graphs = mock<AgentGraphsService>({ stateOfAgent: jest.fn().mockResolvedValue(state) })
    const contracts = mock<AgentGraphContractsService>({
        turnContractsOf: jest.fn().mockResolvedValue({ versionId: "version-1", contracts: [] }),
    })
    const proposals = mock<AgentGraphProposalsService>({ raiseGap: jest.fn().mockResolvedValue(true) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphBriefService,
            { provide: AgentGraphsService, useValue: graphs },
            { provide: AgentGraphContractsService, useValue: contracts },
            { provide: AgentGraphProposalsService, useValue: proposals },
        ],
    }).compile()
    return { service: moduleRef.get(AgentGraphBriefService), graphs, contracts, proposals }
}

const ADAPTER_PATHS = {
    nodes: [
        nodeOf({ key: "wrong-call", kind: "execute", step: "call", action: undefined, next: ["wrong-act"] }),
        nodeOf({ key: "right-act", action: "confirm_order", next: ["right-reply"] }),
        nodeOf({
            key: "wrong-trigger",
            kind: "trigger",
            step: "customer_message",
            action: undefined,
            trigger: { eventTypes: ["customer_message"], sources: ["zalo"] },
            next: ["wrong-call"],
        }),
        nodeOf({
            key: "right-trigger",
            kind: "trigger",
            step: "customer_message",
            action: undefined,
            trigger: { eventTypes: ["customer_message"], sources: ["website"] },
            next: ["right-call"],
        }),
        nodeOf({ key: "right-call", kind: "execute", step: "call", action: undefined, next: ["right-act"] }),
        nodeOf({ key: "wrong-act", action: "confirm_order", next: ["wrong-reply"] }),
        nodeOf({ key: "wrong-reply", kind: "output", step: "reply", action: "reply_customer", next: [] }),
        nodeOf({ key: "right-reply", kind: "output", step: "reply", action: "reply_customer", next: [] }),
    ],
    rights: [],
}

describe("AgentGraphBriefService.intentsOf", () => {
    it("lists the actions of the act nodes of the active version under the titles the owner gave them", async () => {
        const { service, graphs } = await build(stateOf({ mode: "enforced" }))

        await expect(service.intentsOf("ws-1", "agent-1")).resolves.toEqual([
            { action: "pay_supplier", label: "Record the payment" },
        ])
        expect(graphs.stateOfAgent).toHaveBeenCalledWith("ws-1", "agent-1")
    })

    it("lists an action once and skips an act node that carries no action", async () => {
        const active = {
            nodes: [
                nodeOf({ key: "a", action: "pay_supplier" }),
                nodeOf({ key: "b", action: "pay_supplier", title: "Again" }),
                nodeOf({ key: "c", pipeline: "reminder" }),
                nodeOf({ key: "d", kind: "output", step: "stop", action: "ignored" }),
            ],
            rights: [],
        }
        const { service } = await build(stateOf({ mode: "enforced", active }))

        await expect(service.intentsOf("ws-1", "agent-1")).resolves.toEqual([
            { action: "pay_supplier", label: "Record the payment" },
        ])
    })

    it("tells a turn nothing while the graph is only in shadow, has no version or does not exist", async () => {
        const shadow = await build(stateOf())
        const noVersion = await build(stateOf({ mode: "enforced", active: null }))
        const none = await build(null)

        await expect(shadow.service.intentsOf("ws-1", "agent-1")).resolves.toEqual([])
        await expect(noVersion.service.intentsOf("ws-1", "agent-1")).resolves.toEqual([])
        await expect(none.service.intentsOf("ws-1", "agent-1")).resolves.toEqual([])
    })
})

describe("AgentGraphBriefService.contractsOf", () => {
    it("answers the contracts the graph makes of the trigger and the audience of the turn", async () => {
        const { service, contracts } = await build(null)

        await expect(service.contractsOf("ws-1", "agent-1", "tag", "manager")).resolves.toEqual({
            versionId: "version-1",
            contracts: [],
        })
        expect(contracts.turnContractsOf).toHaveBeenCalledWith("ws-1", "agent-1", "tag", "manager", null)
    })
})

describe("AgentGraphBriefService.nodeKeysOf", () => {
    it("uses the source-unspecified trigger path when the caller supplies only the trigger", async () => {
        const { service } = await build(stateOf({ mode: "enforced", active: { nodes: [], rights: [] } }))

        await expect(service.nodeKeysOf("ws-1", "agent-1", "customer_message")).resolves.toEqual({
            turn: "understand",
            acts: {},
        })
    })

    it("names the node where the trigger path picks, and the act node of each intent", async () => {
        const active = {
            nodes: [
                nodeOf({ key: "understand", kind: "execute", step: "call" }),
                nodeOf({ key: "pay", action: "pay_supplier" }),
                nodeOf({ key: "other", kind: "output", step: "stop" }),
            ],
            rights: [],
        }
        const { service } = await build(stateOf({ mode: "enforced", active }))

        await expect(service.nodeKeysOf("ws-1", "agent-1")).resolves.toEqual({
            turn: "understand",
            acts: { pay_supplier: "pay" },
        })
    })

    it("falls back to understand when the graph has no call node or no version", async () => {
        const none = await build(null)

        await expect(none.service.nodeKeysOf("ws-1", "agent-1")).resolves.toEqual({ turn: "understand", acts: {} })
    })

    it("names only the call, actions and reply reached by the actual adapter's trigger", async () => {
        const active = ADAPTER_PATHS
        const { service } = await build(stateOf({ mode: "enforced", active }))

        await expect(service.nodeKeysOf("ws-1", "agent-1", "customer_message", "website")).resolves.toEqual({
            turn: "right-call",
            acts: { confirm_order: "right-act", reply_customer: "right-reply" },
            reply: "right-reply",
        })
        await expect(service.nodeKeysOf("ws-1", "agent-1", "customer_message", "zalo")).resolves.toEqual({
            turn: "wrong-call",
            acts: { confirm_order: "wrong-act", reply_customer: "wrong-reply" },
            reply: "wrong-reply",
        })
        await expect(service.nodeKeysOf("ws-1", "agent-1", "customer_message", "telegram")).resolves.toEqual({
            turn: "understand",
            acts: {},
        })
        await expect(service.nodeKeysOf("ws-1", "agent-1", "tag", "website")).resolves.toEqual({
            turn: "understand",
            acts: {},
        })
    })
})

describe("AgentGraphBriefService.raiseGap", () => {
    it("raises the gap as a proposal to the owner", async () => {
        const { service, proposals } = await build(null)
        const gap = {
            workspaceId: "ws-1",
            agentId: "agent-1",
            versionId: "v-1",
            trigger: "tag",
            question: "q",
            topic: "t",
        } as const

        await expect(service.raiseGap(gap)).resolves.toBe(true)
        expect(proposals.raiseGap).toHaveBeenCalledWith(gap)
    })
})
