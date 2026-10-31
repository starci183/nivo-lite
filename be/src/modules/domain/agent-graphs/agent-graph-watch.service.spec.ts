import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { BrainFactsService } from "@modules/domain/brain-facts"
import type { FactRecord } from "@modules/domain/brain-facts"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { CLOCK } from "@modules/platform/clock"
import { OWNER_EXAMPLE, graphOf, stateOf } from "@tests/fixtures/builders/agent-graph.builder"
import { AgentGraphDecisionsService } from "./agent-graph-decisions.service"
import { AgentGraphProposalsService } from "./agent-graph-proposals.service"
import { AgentGraphSeedService } from "./agent-graph-seed.service"
import { AgentGraphWatchService } from "./agent-graph-watch.service"
import { AgentGraphsService } from "./agent-graphs.service"
import type { BrainSourceInForce } from "./agent-graphs.service"
import { valueHashOf } from "./policies/conflict.policy"

const SOURCE: BrainSourceInForce = {
    workspaceId: "ws-1",
    agentId: "agent-1",
    versionId: "version-1",
    nodeKey: "decide",
    branchKey: "middle",
    factId: "fact-1",
    valueHash: valueHashOf("Over 5tr ask Dinh"),
}

const factOf = (id: string, status: string, value: string): FactRecord =>
    Object.assign(mock<FactRecord>(), { id, status, value, subjectKey: "policy", attribute: "approval" })

const build = async (
    options: {
        pages?: ReadonlyArray<ReadonlyArray<{ id: string; agentId: string | null }>>
        missing?: ReadonlyArray<string>
        seeded?: boolean
        closedAgents?: ReadonlyArray<string>
        state?: ReturnType<typeof stateOf> | null
        sources?: ReadonlyArray<BrainSourceInForce>
        cited?: FactRecord | null
        successor?: FactRecord | null
    } = {},
) => {
    const pages = [...(options.pages ?? [[{ id: "inst-1", agentId: "agent-1" }]]), []]
    const installations = mock<InstallationRecordsService>({
        page: jest.fn().mockImplementation(() => Promise.resolve(pages.shift() ?? [])),
    })
    const graphs = mock<AgentGraphsService>({
        missingGraph: jest.fn().mockResolvedValue(options.missing ?? ["agent-1"]),
        statesOfAgent: jest.fn().mockResolvedValue(options.state === undefined ? stateOf({ mode: "enforced" }) : options.state),
        brainSourcesInForce: jest.fn().mockResolvedValue(options.sources ?? []),
    })
    const seed = mock<AgentGraphSeedService>({ ensureFor: jest.fn().mockResolvedValue(options.seeded === false ? null : stateOf()) })
    const decisions = mock<AgentGraphDecisionsService>({ agentsClosedSince: jest.fn().mockResolvedValue(options.closedAgents ?? []) })
    const proposals = mock<AgentGraphProposalsService>({
        learn: jest.fn().mockResolvedValue(2),
        raiseConflict: jest.fn().mockResolvedValue(true),
    })
    const brain = mock<BrainFactsService>({
        get: jest.fn().mockResolvedValue(options.cited === undefined ? factOf("fact-1", "superseded", "Over 5tr ask Dinh") : options.cited),
        byKey: jest.fn().mockResolvedValue(options.successor === null ? [] : [options.successor ?? factOf("fact-2", "active", "Over 8tr ask Dinh")]),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphWatchService,
            { provide: CLOCK, useValue: new FakeClock("2026-11-01T02:00:00.000Z") },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: AgentGraphsService, useValue: graphs },
            { provide: AgentGraphSeedService, useValue: seed },
            { provide: AgentGraphDecisionsService, useValue: decisions },
            { provide: AgentGraphProposalsService, useValue: proposals },
            { provide: BrainFactsService, useValue: brain },
        ],
    }).compile()
    return { service: moduleRef.get(AgentGraphWatchService), installations, graphs, seed, decisions, proposals, brain }
}

describe("AgentGraphWatchService seeding", () => {
    it("gives the graph to an agent that has none, and walks the installations page by page", async () => {
        const { service, seed, installations } = await build()

        await expect(service.tick()).resolves.toMatchObject({ seeded: 1 })

        expect(seed.ensureFor).toHaveBeenCalledWith("inst-1", "vi")
        expect(installations.page.mock.calls.map((call) => call[0])).toEqual(["", "inst-1"])
    })

    it("leaves alone an installation with no agent and an agent that has a graph, and counts only the seeds that happened", async () => {
        const none = await build({ pages: [[{ id: "inst-1", agentId: null }, { id: "inst-2", agentId: "agent-2" }]], missing: [] })
        const refused = await build({ seeded: false })

        await expect(none.service.tick()).resolves.toMatchObject({ seeded: 0 })
        await expect(refused.service.tick()).resolves.toMatchObject({ seeded: 0 })
        expect(none.seed.ensureFor).not.toHaveBeenCalled()
    })

    it("seeds at most fifty agents in one tick", async () => {
        const many = Array.from({ length: 60 }, (_unused, index) => ({ id: `inst-${index}`, agentId: `agent-${index}` }))
        const { service, seed, graphs } = await build({ pages: [many] })
        graphs.missingGraph.mockResolvedValue(many.map((row) => row.agentId))

        await expect(service.tick()).resolves.toMatchObject({ seeded: 50 })
        expect(seed.ensureFor).toHaveBeenCalledTimes(50)
    })
})

describe("AgentGraphWatchService learning", () => {
    it("raises what the decisions that ended lately teach, for the version that decides", async () => {
        const { service, proposals, decisions } = await build({ missing: [], closedAgents: ["agent-1"] })

        await expect(service.tick()).resolves.toMatchObject({ learned: 2 })

        expect(decisions.agentsClosedSince).toHaveBeenCalledWith(new Date("2026-10-30T02:00:00.000Z"), 500)
        expect(proposals.learn).toHaveBeenCalledWith("ws-1", "agent-1", "version-1", graphOf(OWNER_EXAMPLE))
    })

    it("learns nothing for an agent with no graph or no version that decides", async () => {
        const none = await build({ missing: [], closedAgents: ["agent-1"], state: null })
        const fresh = await build({ missing: [], closedAgents: ["agent-1"], state: stateOf({ active: null, activeVersionId: null }) })

        await expect(none.service.tick()).resolves.toMatchObject({ learned: 0 })
        await expect(fresh.service.tick()).resolves.toMatchObject({ learned: 0 })
        expect(none.proposals.learn).not.toHaveBeenCalled()
    })
})

describe("AgentGraphWatchService the Brain rules", () => {
    it("raises a conflict when the rule a node cites was replaced by one that says something else, and changes no graph", async () => {
        const { service, proposals, graphs } = await build({ missing: [], sources: [SOURCE] })

        await expect(service.tick()).resolves.toMatchObject({ conflicts: 1 })

        expect(proposals.raiseConflict).toHaveBeenCalledWith("ws-1", "agent-1", "version-1", {
            nodeKey: "decide",
            branchKey: "middle",
            oldFactId: "fact-1",
            newFactId: "fact-2",
            newValueHash: valueHashOf("Over 8tr ask Dinh"),
            dedupeKey: "conflict:decide:fact-2",
        })
        expect(graphs.brainSourcesInForce).toHaveBeenCalledWith(500)
    })

    it("raises nothing while the cited rule is in force, is gone, has no successor, or the proposal already exists", async () => {
        const inForce = await build({ missing: [], sources: [SOURCE], cited: factOf("fact-1", "active", "Over 5tr ask Dinh") })
        const gone = await build({ missing: [], sources: [SOURCE], cited: null })
        const alone = await build({ missing: [], sources: [SOURCE], successor: null })
        const known = await build({ missing: [], sources: [SOURCE] })
        known.proposals.raiseConflict.mockResolvedValue(false)

        for (const built of [inForce, gone, alone]) {
            await expect(built.service.tick()).resolves.toMatchObject({ conflicts: 0 })
            expect(built.proposals.raiseConflict).not.toHaveBeenCalled()
        }
        await expect(known.service.tick()).resolves.toMatchObject({ conflicts: 0 })
    })
})
