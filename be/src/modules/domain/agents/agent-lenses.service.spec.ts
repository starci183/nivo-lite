import { Test } from "@nestjs/testing"
import { AGENT_LENS_COUNTS, agentInstallationOf as installationOf } from "@tests/fixtures/builders/agents.builder"
import { mock } from "@starci/jest-preset"
import { AgentLensesService } from "./agent-lenses.service"
import { AGENTS_INSTALLATIONS, AGENTS_KNOWLEDGE } from "./agents.decorators"
import type { AgentSummary } from "./agents.contracts"
import type { InstallationDirectory, KnowledgeLens } from "./agents.port"
import { AgentsService } from "./agents.service"

const OPEN = {
    documentPublic: true,
    documentInternal: true,
    factPublic: true,
    factInternal: true,
    factRestricted: true,
}
const PUBLIC_ONLY = { ...OPEN, documentInternal: false, factInternal: false, factRestricted: false }

const agentOf = (id: string, status: string): AgentSummary => ({
    id,
    module: "chatbot",
    name: `Agent ${id}`,
    handle: id,
    role: "Front desk",
    status,
    avatarUrl: null,
    createdAt: "2026-10-01T00:00:00.000Z",
})

const build = async (agents: ReadonlyArray<AgentSummary>) => {
    const service = mock<AgentsService>({ list: jest.fn(() => Promise.resolve(agents)) })
    const installations = mock<InstallationDirectory>({
        ofAgent: jest.fn(() => Promise.resolve(installationOf())),
    })
    const knowledge = mock<KnowledgeLens>({
        countsFor: jest.fn(() => Promise.resolve(AGENT_LENS_COUNTS)),
        lanesOf: jest.fn(() => PUBLIC_ONLY),
        customerLanes: jest.fn(() => PUBLIC_ONLY),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentLensesService,
            { provide: AgentsService, useValue: service },
            { provide: AGENTS_INSTALLATIONS, useValue: installations },
            { provide: AGENTS_KNOWLEDGE, useValue: knowledge },
        ],
    }).compile()
    return { lenses: moduleRef.get(AgentLensesService), service, installations, knowledge }
}

describe("AgentLensesService", () => {
    it("answers the customer's view first, uncounted, then the view of each active agent through its instance", async () => {
        const { lenses, service, installations, knowledge } = await build([
            agentOf("a1", "active"),
            agentOf("a2", "paused"),
        ])
        knowledge.lanesOf.mockReturnValue(OPEN)

        const views = await lenses.list("u1", "w1")

        expect(service.list).toHaveBeenCalledWith("u1", "w1")
        expect(views).toHaveLength(2)
        expect(views[0]).toMatchObject({ kind: "customer", agentId: null, name: null, audience: "customer" })
        expect(views[0]?.cells).toEqual([
            { lane: "documentPublic", isOpen: true, count: null },
            { lane: "documentInternal", isOpen: false, count: null },
            { lane: "factPublic", isOpen: true, count: null },
            { lane: "factInternal", isOpen: false, count: null },
            { lane: "factRestricted", isOpen: false, count: null },
        ])
        expect(views[1]).toMatchObject({
            kind: "agent",
            agentId: "a1",
            name: "Agent a1",
            module: "chatbot",
            installationId: "i1",
            audience: AGENT_LENS_COUNTS.audience,
        })
        expect(views[1]?.cells).toEqual([
            { lane: "documentPublic", isOpen: true, count: 1 },
            { lane: "documentInternal", isOpen: true, count: 0 },
            { lane: "factPublic", isOpen: true, count: 2 },
            { lane: "factInternal", isOpen: true, count: 0 },
            { lane: "factRestricted", isOpen: true, count: 0 },
        ])
        expect(installations.ofAgent).toHaveBeenCalledTimes(1)
        expect(knowledge.countsFor).toHaveBeenCalledWith("w1", "chatbot", "i1")
        expect(knowledge.lanesOf).toHaveBeenCalledWith("chatbot")
    })

    it("keeps an agent without an instance on the shared knowledge", async () => {
        const { lenses, installations, knowledge } = await build([agentOf("a1", "active")])
        installations.ofAgent.mockResolvedValue(null)

        const views = await lenses.list("u1", "w1")

        expect(views[1]).toMatchObject({ installationId: null })
        expect(knowledge.countsFor).toHaveBeenCalledWith("w1", "chatbot", null)
    })

    it("lets the member check list refuse a person outside the workspace", async () => {
        const { lenses, service } = await build([])
        const refusal = new Error("not a member")
        service.list.mockRejectedValue(refusal)

        await expect(lenses.list("u1", "w1")).rejects.toBe(refusal)
    })
})
