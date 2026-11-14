import { Test } from "@nestjs/testing"
import { SCOPE } from "@tests/fixtures/builders/agent-graph-records.builder"
import { MemoryTables, memoryGraphStore } from "@tests/fixtures/builders/engine-core-tables.builder"
import { AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import { AgentGraphRecordsService } from "./agent-graph-records.service"
import { AGENT_GRAPH_STORE } from "./agent-graph-store.port"
import type { GraphInsert, ProposalInsert, SourceInsert, VersionInsert } from "./agent-graphs-records.contracts"
import { TestWorldError, TestWorldErrorCode } from "@tests/world/test-world.error"

/** A clock of the table double: each write a minute after the one before, so "newest first" is told by the stamp. */
const ticking = (): (() => string) => {
    let minute = 0
    return () => {
        minute += 1
        return new Date(Date.UTC(2026, 10, 1, 1, minute)).toISOString()
    }
}

const build = async () => {
    const tables = new MemoryTables(ticking())
    const moduleRef = await Test.createTestingModule({
        providers: [AgentGraphRecordsService, { provide: AGENT_GRAPH_STORE, useValue: memoryGraphStore(tables) }],
    }).compile()
    return { service: moduleRef.get(AgentGraphRecordsService), tables }
}

const GRAPH = (agentId: string, installationId = `inst-${agentId}`): GraphInsert => ({
    agentId,
    installationId,
    draft: { nodes: [] },
    draftRev: 1,
    mode: "enforced",
})

const VERSION = (number: number, agentId = "agent-1"): VersionInsert => ({
    agentId,
    number,
    document: { nodes: [] },
    documentHash: "hash",
    contextVersionId: null,
    changeKind: "edit",
    note: "",
    publishedBy: null,
})

const SOURCE = (versionId: string, kind: string, ref: string): SourceInsert => ({
    versionId,
    agentId: "agent-1",
    nodeKey: "decide",
    branchKey: "",
    kind,
    ref,
    valueHash: "hash",
})

const PROPOSAL = (dedupeKey: string, kind: ProposalInsert["kind"] = "learned"): ProposalInsert => ({
    agentId: "agent-1",
    dedupeKey,
    kind,
    baseVersionId: null,
    nodeKey: "decide",
    branchKey: "middle",
    patch: { signal: "trust" },
    widens: false,
    evidence: { ids: ["d0"] },
})

describe("AgentGraphRecordsService graphs", () => {
    it("reads the graph of an agent, or of an installation", async () => {
        const { service } = await build()
        await service.ensureGraph(SCOPE, GRAPH("agent-1", "inst-1"))

        await expect(service.graphOf(SCOPE, "agent-1")).resolves.toMatchObject({ agentId: "agent-1", fence: "1" })
        await expect(service.graphOfInstallation(SCOPE, "inst-1")).resolves.toMatchObject({ agentId: "agent-1" })
    })

    it("answers nothing for an agent or installation with no graph", async () => {
        const { service } = await build()
        await expect(service.graphOf(SCOPE, "agent-9")).resolves.toBeNull()
        await expect(service.graphOfInstallation(SCOPE, "inst-9")).resolves.toBeNull()
    })

    it("names which of some agents hold a graph, ordered by agent", async () => {
        const { service } = await build()
        await service.ensureGraph(SCOPE, GRAPH("agent-2"))
        await service.ensureGraph(SCOPE, GRAPH("agent-1"))

        await expect(service.agentsWithGraph(SCOPE, ["agent-2", "agent-1", "agent-3"])).resolves.toEqual(["agent-1", "agent-2"])
    })

    it("lists the graphs of the workspace with no filter, ordered by agent", async () => {
        const { service } = await build()
        await service.ensureGraph(SCOPE, GRAPH("agent-2"))
        await service.ensureGraph(SCOPE, GRAPH("agent-1"))

        const graphs = await service.graphsOfWorkspace(SCOPE, 10)
        expect(graphs.map((graph) => graph.agentId)).toEqual(["agent-1", "agent-2"])
        await expect(service.graphsOfWorkspace(SCOPE, 1)).resolves.toHaveLength(1)
    })
})

describe("AgentGraphRecordsService graph writes", () => {
    it("finds or makes the graph of its agent, and says whether it made it", async () => {
        const { service } = await build()
        await expect(service.ensureGraph(SCOPE, GRAPH("agent-1"))).resolves.toMatchObject({ created: true })
        await expect(service.ensureGraph(SCOPE, GRAPH("agent-1"))).resolves.toMatchObject({
            created: false,
            graph: { agentId: "agent-1" },
        })
    })

    it("writes a graph under the version the caller read, and answers null when it moved on", async () => {
        const { service } = await build()
        const { graph } = await service.ensureGraph(SCOPE, GRAPH("agent-1"))

        await expect(service.patchGraph(SCOPE, graph, { mode: "shadow" })).resolves.toMatchObject({ mode: "shadow", fence: "2" })
        await expect(service.patchGraph(SCOPE, graph, { mode: "enforced" })).resolves.toBeNull()
    })

    it("refuses a source the version already holds, as a reason it cannot read", async () => {
        const { service } = await build()
        await service.insertSource(SCOPE, SOURCE("version-1", "brain", "fact-1"))
        await expect(service.insertSource(SCOPE, SOURCE("version-1", "brain", "fact-1"))).rejects.toMatchObject({
            code: AgentGraphsErrorCode.RecordUnreadable,
        })
    })
})

describe("AgentGraphRecordsService versions and sources", () => {
    it("reads a version by id, or null", async () => {
        const { service } = await build()
        const version = await service.insertVersion(SCOPE, VERSION(1))

        await expect(service.version(SCOPE, version?.id ?? "")).resolves.toMatchObject({ number: 1, changeKind: "edit" })
        await expect(service.version(SCOPE, "version-9")).resolves.toBeNull()
    })

    it("lists the versions of an agent newest first", async () => {
        const { service } = await build()
        await service.insertVersion(SCOPE, VERSION(1))
        await service.insertVersion(SCOPE, VERSION(2))
        await service.insertVersion(SCOPE, VERSION(1, "agent-2"))

        const versions = await service.versionsOf(SCOPE, "agent-1", 10)
        expect(versions.map((version) => version.number)).toEqual([2, 1])
        await expect(service.latestVersion(SCOPE, "agent-1")).resolves.toMatchObject({ number: 2 })
    })

    it("answers no latest version for an agent with none", async () => {
        const { service } = await build()
        await expect(service.latestVersion(SCOPE, "agent-1")).resolves.toBeNull()
    })

    it("inserts a version, and answers null when its number is already the agent's", async () => {
        const { service } = await build()
        await expect(service.insertVersion(SCOPE, VERSION(1))).resolves.toMatchObject({ number: 1 })
        await expect(service.insertVersion(SCOPE, VERSION(1))).resolves.toBeNull()
    })

    it("indexes a source and reads the sources of one kind among some versions", async () => {
        const { service } = await build()
        await service.insertSource(SCOPE, SOURCE("version-1", "brain", "fact-1"))
        await service.insertSource(SCOPE, SOURCE("version-2", "brain", "fact-2"))
        await service.insertSource(SCOPE, SOURCE("version-1", "template", "t-1"))
        await service.insertSource(SCOPE, SOURCE("version-3", "brain", "fact-3"))

        const sources = await service.sourcesOf(SCOPE, "brain", ["version-1", "version-2"], 10)
        expect(sources.map((source) => source.ref)).toEqual(["fact-1", "fact-2"])
        await expect(service.sourcesOf(SCOPE, "brain", ["version-1", "version-2"], 1)).resolves.toHaveLength(1)
    })
})

describe("AgentGraphRecordsService proposals", () => {
    it("reads a proposal by id, or null", async () => {
        const { service, tables } = await build()
        await service.raiseProposal(SCOPE, PROPOSAL("cause-1"))
        const [row] = tables.of("agent_graph_proposals")

        await expect(service.proposal(SCOPE, row?.id ?? "")).resolves.toMatchObject({ status: "open", evidence: ["d0"] })
        await expect(service.proposal(SCOPE, "p-9")).resolves.toBeNull()
    })

    it("lists the open proposals of an agent newest first", async () => {
        const { service } = await build()
        await service.raiseProposal(SCOPE, PROPOSAL("cause-1"))
        await service.raiseProposal(SCOPE, PROPOSAL("cause-2"))
        await service.raiseProposal(SCOPE, PROPOSAL("cause-3", "gap"))
        const learnedOpen = (await service.openProposalsOf(SCOPE, "agent-1", 10)).find((proposal) => proposal.kind === "learned")
        if (learnedOpen === undefined) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: "no proposal" } })
        await service.patchProposal(SCOPE, learnedOpen, { status: "declined" })

        const open = await service.openProposalsOf(SCOPE, "agent-1", 10)
        expect(open.map((proposal) => proposal.kind)).toEqual(["gap", "learned"])
    })

    it("raises a proposal once per cause, and says whether this call wrote it", async () => {
        const { service } = await build()
        await expect(service.raiseProposal(SCOPE, PROPOSAL("cause-1"))).resolves.toBe(true)
        await expect(service.raiseProposal(SCOPE, PROPOSAL("cause-1"))).resolves.toBe(false)
    })

    it("writes a proposal under the version the caller read, and answers null when it moved on", async () => {
        const { service } = await build()
        await service.raiseProposal(SCOPE, PROPOSAL("cause-1"))
        const [read] = await service.openProposalsOf(SCOPE, "agent-1", 1)
        if (read === undefined) throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { what: "no proposal" } })

        await expect(service.patchProposal(SCOPE, read, { status: "confirmed" })).resolves.toMatchObject({ status: "confirmed" })
        await expect(service.patchProposal(SCOPE, read, { status: "declined" })).resolves.toBeNull()
    })
})
