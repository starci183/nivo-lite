import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { BrainFactsService } from "@modules/domain/brain-facts"
import type { FactRecord } from "@modules/domain/brain-facts"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { WorkspacesService } from "@modules/domain/workspaces"
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

interface Row {
    id: string
    agentId: string | null
    workspaceId: string
    moduleKey: string
}

const rowOf = (id: string, agentId: string | null): Row => ({
    id,
    agentId,
    workspaceId: "ws-1",
    moduleKey: "accounting",
})

const build = async (
    options: {
        pages?: ReadonlyArray<ReadonlyArray<Row>>
        moved?: boolean
        missing?: ReadonlyArray<string>
        seeded?: boolean
        closedAgents?: ReadonlyArray<string>
        state?: ReturnType<typeof stateOf> | null
        sources?: ReadonlyArray<BrainSourceInForce>
        cited?: FactRecord | null
        successor?: FactRecord | null
    } = {},
) => {
    const pages = options.pages ?? [[rowOf("inst-1", "agent-1")]]
    const installations = mock<InstallationRecordsService>({
        page: jest.fn().mockImplementation((after: string) => {
            const index = after === "" ? -1 : pages.findIndex((page) => page.at(-1)?.id === after)
            return Promise.resolve(pages[index + 1] ?? [])
        }),
    })
    const graphs = mock<AgentGraphsService>({
        missingGraph: jest.fn().mockResolvedValue(options.missing ?? ["agent-1"]),
        stateOfAgent: jest
            .fn()
            .mockResolvedValue(options.state === undefined ? stateOf({ mode: "enforced" }) : options.state),
        brainSourcesInForce: jest.fn().mockResolvedValue(options.sources ?? []),
    })
    const seed = mock<AgentGraphSeedService>({
        ensureFor: jest.fn().mockResolvedValue(options.seeded === false ? null : stateOf()),
        refresh: jest.fn().mockResolvedValue(options.moved ?? false),
    })
    const decisions = mock<AgentGraphDecisionsService>({
        agentsClosedSince: jest.fn().mockResolvedValue(options.closedAgents ?? []),
    })
    const proposals = mock<AgentGraphProposalsService>({
        learn: jest.fn().mockResolvedValue(2),
        raiseConflict: jest.fn().mockResolvedValue(true),
    })
    const brain = mock<BrainFactsService>({
        get: jest
            .fn()
            .mockResolvedValue(
                options.cited === undefined ? factOf("fact-1", "superseded", "Over 5tr ask Dinh") : options.cited,
            ),
        byKey: jest
            .fn()
            .mockResolvedValue(
                options.successor === null
                    ? []
                    : [options.successor ?? factOf("fact-2", "active", "Over 8tr ask Dinh")],
            ),
    })
    const workspaces = mock<WorkspacesService>({
        list: jest.fn().mockResolvedValue([{ id: "ws-1", name: "Shop" }]),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphWatchService,
            { provide: WorkspacesService, useValue: workspaces },
            { provide: CLOCK, useValue: new FakeClock("2026-11-01T02:00:00.000Z") },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: AgentGraphsService, useValue: graphs },
            { provide: AgentGraphSeedService, useValue: seed },
            { provide: AgentGraphDecisionsService, useValue: decisions },
            { provide: AgentGraphProposalsService, useValue: proposals },
            { provide: BrainFactsService, useValue: brain },
        ],
    }).compile()
    return {
        service: moduleRef.get(AgentGraphWatchService),
        installations,
        graphs,
        seed,
        decisions,
        proposals,
        brain,
        workspaces,
    }
}

describe("AgentGraphWatchService seeding", () => {
    it("gives the graph to an agent that has none, and walks the installations page by page", async () => {
        const { service, seed, installations } = await build()

        await expect(service.tick()).resolves.toMatchObject({ seeded: 1 })

        expect(seed.ensureFor).toHaveBeenCalledWith("inst-1", "vi")
        expect(installations.page.mock.calls.map((call) => call[0])).toEqual(["", "inst-1", "", "inst-1"])
    })

    it("leaves alone an installation with no agent and an agent that has a graph, and counts only the seeds that happened", async () => {
        const none = await build({
            pages: [[rowOf("inst-1", null), rowOf("inst-2", "agent-2")]],
            missing: [],
        })
        const refused = await build({ seeded: false })

        await expect(none.service.tick()).resolves.toMatchObject({ seeded: 0 })
        await expect(refused.service.tick()).resolves.toMatchObject({ seeded: 0 })
        expect(none.seed.ensureFor).not.toHaveBeenCalled()
    })

    it("seeds at most fifty agents in one tick", async () => {
        const many = Array.from({ length: 60 }, (_unused, index) => rowOf(`inst-${index}`, `agent-${index}`))
        const { service, seed, graphs } = await build({ pages: [many] })
        graphs.missingGraph.mockResolvedValue(many.map((_row, index) => `agent-${index}`))

        await expect(service.tick()).resolves.toMatchObject({ seeded: 50 })
        expect(seed.ensureFor).toHaveBeenCalledTimes(50)
    })
})

describe("AgentGraphWatchService refreshing", () => {
    it("brings a seed up to its rule, for the installation of the agent and its module", async () => {
        const { service, seed, graphs } = await build({ missing: [], moved: true })

        await expect(service.tick()).resolves.toMatchObject({ refreshed: 1 })

        expect(graphs.stateOfAgent).toHaveBeenCalledWith("ws-1", "agent-1")
        expect(seed.refresh).toHaveBeenCalledWith(stateOf({ mode: "enforced" }), "accounting", "vi")
    })

    it("counts only the seeds that moved, and reads nothing of an installation with no agent or an agent with no graph", async () => {
        const stays = await build({ missing: [] })
        const noAgent = await build({ missing: [], moved: true, pages: [[rowOf("inst-1", null)]] })
        const noGraph = await build({ missing: [], moved: true, state: null })

        await expect(stays.service.tick()).resolves.toMatchObject({ refreshed: 0 })
        await expect(noAgent.service.tick()).resolves.toMatchObject({ refreshed: 0 })
        await expect(noGraph.service.tick()).resolves.toMatchObject({ refreshed: 0 })
        expect(noAgent.graphs.stateOfAgent).not.toHaveBeenCalled()
        expect(noGraph.seed.refresh).not.toHaveBeenCalled()
    })

    it("moves at most fifty seeds in one tick, across pages", async () => {
        const rows = Array.from({ length: 90 }, (_unused, index) => rowOf(`inst-${index}`, `agent-${index}`))
        const pages = [rows.slice(0, 30), rows.slice(30, 60), rows.slice(60)]
        const { service, seed } = await build({ pages, missing: [], moved: true })

        await expect(service.tick()).resolves.toMatchObject({ refreshed: 50 })
        expect(seed.refresh).toHaveBeenCalledTimes(50)
    })

    it("walks at most ten pages of installations", async () => {
        const pages = Array.from({ length: 12 }, (_unused, index) => [rowOf(`inst-${index}`, `agent-${index}`)])
        const { service, seed } = await build({ pages, missing: [] })

        await service.tick()

        expect(seed.refresh).toHaveBeenCalledTimes(10)
    })
})

describe("AgentGraphWatchService learning", () => {
    it("raises what the decisions that ended lately teach, for the version that decides", async () => {
        const { service, proposals, decisions } = await build({ missing: [], closedAgents: ["agent-1"] })

        await expect(service.tick()).resolves.toMatchObject({ learned: 2 })

        expect(decisions.agentsClosedSince).toHaveBeenCalledWith("ws-1", new Date("2026-10-30T02:00:00.000Z"), 500)
        expect(proposals.learn).toHaveBeenCalledWith("ws-1", "agent-1", "version-1", graphOf(OWNER_EXAMPLE))
    })

    it("learns nothing for an agent with no graph or no version that decides", async () => {
        const none = await build({ missing: [], closedAgents: ["agent-1"], state: null })
        const fresh = await build({
            missing: [],
            closedAgents: ["agent-1"],
            state: stateOf({ active: null, activeVersionId: null }),
        })

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
        expect(graphs.brainSourcesInForce).toHaveBeenCalledWith("ws-1", 500)
    })

    it("raises nothing while the cited rule is in force, is gone, has no successor, or the proposal already exists", async () => {
        const inForce = await build({
            missing: [],
            sources: [SOURCE],
            cited: factOf("fact-1", "active", "Over 5tr ask Dinh"),
        })
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

describe("AgentGraphWatchService the workspaces of a tick", () => {
    it("asks which agents lack a graph one workspace at a time", async () => {
        const rows = [
            { ...rowOf("inst-1", "agent-1"), workspaceId: "ws-1" },
            { ...rowOf("inst-2", "agent-2"), workspaceId: "ws-2" },
            { ...rowOf("inst-3", "agent-3"), workspaceId: "ws-1" },
        ]
        const { service, graphs } = await build({ pages: [rows], missing: [] })

        await service.tick()

        expect(graphs.missingGraph.mock.calls.slice(0, 2)).toEqual([
            ["ws-1", ["agent-1", "agent-3"]],
            ["ws-2", ["agent-2"]],
        ])
    })

    it("visits a slice of workspaces per tick and starts over after the last one", async () => {
        const full = Array.from({ length: 50 }, (_unused, index) => ({ id: `ws-${index}`, name: "Shop" }))
        const { service, workspaces, decisions } = await build({ missing: [] })
        workspaces.list.mockResolvedValueOnce(full).mockResolvedValueOnce([{ id: "ws-99", name: "Shop" }])

        await service.tick()
        await service.tick()
        await service.tick()

        expect(workspaces.list.mock.calls).toEqual([
            [50, undefined],
            [50, "ws-49"],
            [50, undefined],
        ])
        expect(decisions.agentsClosedSince).toHaveBeenCalledTimes(50 + 1 + 1)
    })
})
