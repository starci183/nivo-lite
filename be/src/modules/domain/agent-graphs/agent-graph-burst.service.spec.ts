import { readFileSync } from "node:fs"
import { join } from "node:path"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { graphSpecSchema } from "@nivo-lite/agent-sdk/graph"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import type { GraphDocument } from "./agent-graphs.contracts"
import { AgentGraphBurstService } from "./agent-graph-burst.service"
import { AgentGraphsService } from "./agent-graphs.service"

/** A flow F graph as the seed ships it. */
const seeded = (name: string): GraphSpec =>
    graphSpecSchema.parse(
        JSON.parse(
            readFileSync(join(__dirname, `../../../../../.starcistacks/dev/seeds/data/graphs/${name}.json`), "utf8"),
        ),
    )

const documentOf = (flow: GraphSpec | undefined): GraphDocument => ({ nodes: [], rights: [], flow })

const build = async () => {
    const graphs = mock<AgentGraphsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [AgentGraphBurstService, { provide: AgentGraphsService, useValue: graphs }],
    }).compile()
    return { service: moduleRef.get(AgentGraphBurstService), graphs }
}

describe("AgentGraphBurstService", () => {
    it("answers what the live flow of the agent asks for a kind of tag: six seconds and twenty at most for the chatbot's channel", async () => {
        const { service, graphs } = await build()
        graphs.activeVersionIdOf.mockResolvedValue("v1")
        graphs.documentOf.mockResolvedValue(documentOf(seeded("chatbot")))

        await expect(service.burstOf("ws-1", "chat", "channel")).resolves.toEqual({ windowMs: 6000, maxWaitMs: 20_000 })
        await expect(service.burstOf("ws-1", "chat", "agent")).resolves.toBeNull()
    })

    it("answers zero for the tags of Sales and Accounting that arrive from an agent or a system event, and nothing for a channel", async () => {
        const { service, graphs } = await build()
        graphs.activeVersionIdOf.mockResolvedValue("v1")
        graphs.documentOf.mockResolvedValue(documentOf(seeded("sales")))

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
            ...seeded("chatbot"),
            trigger: { kind: "tag" as const, sources: ["agent" as const], burst: { channel: { window: "6s" } } },
        }
        graphs.activeVersionIdOf.mockResolvedValue("v3")
        graphs.documentOf.mockResolvedValue(documentOf(narrow))
        await expect(service.burstOf("ws-1", "narrow", "channel")).resolves.toBeNull()
    })

    it("reads the flow of a version once, takes up a new version at the next wake, and reads none when the version cannot be read", async () => {
        const { service, graphs } = await build()
        graphs.activeVersionIdOf.mockResolvedValue("v1")
        graphs.documentOf.mockResolvedValue(documentOf(seeded("chatbot")))
        await service.burstOf("ws-1", "chat", "channel")
        await service.burstOf("ws-1", "chat", "channel")
        expect(graphs.documentOf).toHaveBeenCalledTimes(1)

        graphs.activeVersionIdOf.mockResolvedValue("v2")
        graphs.documentOf.mockRejectedValue(new Error("unreadable"))
        await expect(service.burstOf("ws-1", "chat", "channel")).resolves.toBeNull()
        await service.burstOf("ws-1", "chat", "channel")
        expect(graphs.documentOf).toHaveBeenCalledTimes(2)
    })
})
