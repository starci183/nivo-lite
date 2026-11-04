import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { GraphSpec, GraphSpecTrigger } from "@nivo-lite/agent-sdk/graph"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { GraphDocument } from "./agent-graphs.contracts"
import { AgentGraphBurstService } from "./agent-graph-burst.service"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"
import { AgentGraphsService } from "./agent-graphs.service"

const ALL_SOURCES: GraphSpecTrigger["sources"] = ["channel", "chats-group", "agent", "system-event", "schedule"]

/** A flow F graph as the seed ships its trigger. */
const flowOf = (burst: GraphSpecTrigger["burst"]): GraphSpec => ({
    schema: "nivo/agent-graph@1",
    moduleKey: "chat",
    trigger: { kind: "tag", sources: ALL_SOURCES, burst },
    grant: { rights: [], tools: [], effects: [] },
    nodes: [],
})

/** The chatbot's flow: a channel burst of six seconds, twenty at most. */
const CHATBOT = flowOf({ channel: { window: "6s", maxWait: "20s" } })

/** The flow of Sales: no burst for an agent or a system event. */
const SALES = flowOf({ agent: { window: "0s" }, "system-event": { window: "0s" } })

const documentOf = (flow: GraphSpec | undefined): GraphDocument => ({ nodes: [], rights: [], flow })

const build = async () => {
    const graphs = mock<AgentGraphsService>()
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphBurstService,
            { provide: AgentGraphsService, useValue: graphs },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(AgentGraphBurstService), graphs, logger }
}

describe("AgentGraphBurstService", () => {
    it("answers what the live flow of the agent asks for a kind of tag: six seconds and twenty at most for the chatbot's channel", async () => {
        const { service, graphs } = await build()
        graphs.activeVersionIdOf.mockResolvedValue("v1")
        graphs.documentOf.mockResolvedValue(documentOf(CHATBOT))

        await expect(service.burstOf("ws-1", "chat", "channel")).resolves.toEqual({ windowMs: 6000, maxWaitMs: 20_000 })
        await expect(service.burstOf("ws-1", "chat", "agent")).resolves.toBeNull()
    })

    it("answers zero for the tags of Sales and Accounting that arrive from an agent or a system event, and nothing for a channel", async () => {
        const { service, graphs } = await build()
        graphs.activeVersionIdOf.mockResolvedValue("v1")
        graphs.documentOf.mockResolvedValue(documentOf(SALES))

        await expect(service.burstOf("ws-1", "sales", "agent")).resolves.toEqual({ windowMs: 0, maxWaitMs: null })
        await expect(service.burstOf("ws-1", "sales", "system-event")).resolves.toEqual({
            windowMs: 0,
            maxWaitMs: null,
        })
        await expect(service.burstOf("ws-1", "sales", "channel")).resolves.toBeNull()
    })

    it("asks nothing of an agent with no live version, no flow, or a source its trigger does not list", async () => {
        const { service, graphs } = await build()
        graphs.activeVersionIdOf.mockResolvedValueOnce(null)
        await expect(service.burstOf("ws-1", "none", "channel")).resolves.toBeNull()

        graphs.activeVersionIdOf.mockResolvedValue("v2")
        graphs.documentOf.mockResolvedValue(documentOf(undefined))
        await expect(service.burstOf("ws-1", "rules", "channel")).resolves.toBeNull()

        const narrow = {
            ...CHATBOT,
            trigger: { kind: "tag" as const, sources: ["agent" as const], burst: { channel: { window: "6s" } } },
        }
        graphs.activeVersionIdOf.mockResolvedValue("v3")
        graphs.documentOf.mockResolvedValue(documentOf(narrow))
        await expect(service.burstOf("ws-1", "narrow", "channel")).resolves.toBeNull()
    })

    it("reads the flow of a version once, takes up a new version at the next wake, and reads none when the version cannot be read", async () => {
        const { service, graphs, logger } = await build()
        graphs.activeVersionIdOf.mockResolvedValue("v1")
        graphs.documentOf.mockResolvedValue(documentOf(CHATBOT))
        await service.burstOf("ws-1", "chat", "channel")
        await service.burstOf("ws-1", "chat", "channel")
        expect(graphs.documentOf).toHaveBeenCalledTimes(1)

        const unreadable = new Error("unreadable")
        graphs.activeVersionIdOf.mockResolvedValue("v2")
        graphs.documentOf.mockRejectedValue(unreadable)
        await expect(service.burstOf("ws-1", "chat", "channel")).resolves.toBeNull()
        await service.burstOf("ws-1", "chat", "channel")
        expect(graphs.documentOf).toHaveBeenCalledTimes(2)
        expect(logger.error).toHaveBeenCalledWith(AgentGraphsLogEvent.BurstFlowUnreadable, unreadable, {
            agentId: "chat",
            versionId: "v2",
        })
    })
})
