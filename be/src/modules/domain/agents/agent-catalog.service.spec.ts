import { Test } from "@nestjs/testing"
import { AGENT_LENS_COUNTS, agentInstallationOf as installationOf } from "@tests/fixtures/builders/agents.builder"
import { mock } from "@starci/jest-preset"
import { AgentCatalogService } from "./agent-catalog.service"
import { AGENTS_CONNECTIONS, AGENTS_INSTALLATIONS, AGENTS_KNOWLEDGE } from "./agents.decorators"
import type { AgentSummary } from "./agents.contracts"
import type { AgentConnectionsDirectory, InstallationDirectory, KnowledgeLens } from "./agents.port"
import { AgentsService } from "./agents.service"

const agentOf = (id: string): AgentSummary => ({
    id,
    module: "chatbot",
    name: `Agent ${id}`,
    handle: id,
    role: "Front desk",
    status: "active",
    avatarUrl: null,
    createdAt: "2026-10-01T00:00:00.000Z",
})

const build = async (agents: ReadonlyArray<AgentSummary>) => {
    const service = mock<AgentsService>({ list: jest.fn(() => Promise.resolve(agents)) })
    const bindings = mock<AgentConnectionsDirectory>({
        connectionsOfAgents: jest.fn(() =>
            Promise.resolve([
                {
                    agentId: "a1",
                    connection: {
                        id: "c1",
                        provider: "telegram",
                        name: "Shop bot",
                        botUsername: "shop_bot",
                        accountMasked: null,
                        status: "connected",
                        purpose: "inbound_chat" as const,
                    },
                },
            ]),
        ),
    })
    const installations = mock<InstallationDirectory>({
        ofAgent: jest.fn((_workspaceId: string, agentId: string) =>
            Promise.resolve(agentId === "a1" ? installationOf() : null),
        ),
    })
    const knowledge = mock<KnowledgeLens>({
        countsFor: jest.fn(() => Promise.resolve(AGENT_LENS_COUNTS)),
        waitingFactsOf: jest.fn(() => Promise.resolve(4)),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentCatalogService,
            { provide: AgentsService, useValue: service },
            { provide: AGENTS_CONNECTIONS, useValue: bindings },
            { provide: AGENTS_INSTALLATIONS, useValue: installations },
            { provide: AGENTS_KNOWLEDGE, useValue: knowledge },
        ],
    }).compile()
    return { catalog: moduleRef.get(AgentCatalogService), service, bindings, installations, knowledge }
}

describe("AgentCatalogService", () => {
    it("reads every agent grants in one call and its knowledge through its own lens", async () => {
        const { catalog, service, bindings, knowledge } = await build([agentOf("a1"), agentOf("a2")])

        const entries = await catalog.list("u1", "w1")

        expect(service.list).toHaveBeenCalledWith("u1", "w1")
        expect(bindings.connectionsOfAgents).toHaveBeenCalledTimes(1)
        expect(bindings.connectionsOfAgents).toHaveBeenCalledWith("u1", "w1", ["a1", "a2"])
        expect(knowledge.countsFor).toHaveBeenCalledTimes(2)
        expect(entries).toHaveLength(2)
        expect(entries[0]).toMatchObject({
            agentId: "a1",
            grants: [{ connectionId: "c1", provider: "telegram", purpose: "inbound_chat" }],
            knowledge: { audience: "customer", documents: 1, factsApproved: 2, factsTotal: 6, factsWaiting: 4 },
        })
    })

    it("lists an agent with no grants and no instance as it is", async () => {
        const { catalog } = await build([agentOf("a2")])

        const [entry] = await catalog.list("u1", "w1")

        expect(entry).toMatchObject({ agentId: "a2", installationId: null, grants: [] })
    })

    it("answers nothing for a workspace without agents", async () => {
        const { catalog } = await build([])

        await expect(catalog.list("u1", "w1")).resolves.toEqual([])
    })
})
