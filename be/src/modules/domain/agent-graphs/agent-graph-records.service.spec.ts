import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { EntityEngineService, EntityMutationService } from "@modules/domain/entity-engine"
import type { EngineResult, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import type { Query } from "@nivo-lite/agent-sdk/query"
import { decisionRow, graphRow, proposalRow } from "@tests/fixtures/builders/agent-graph.builder"
import {
    SCOPE,
    decisionEngineRow,
    graphEngineRow,
    pageOf,
    proposalEngineRow,
    sourceEngineRow,
    versionEngineRow,
} from "@tests/fixtures/builders/agent-graph-records.builder"
import { AgentGraphRecordsService } from "./agent-graph-records.service"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"

const build = async () => {
    const engine = mock<EntityEngineService>()
    const mutations = mock<EntityMutationService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphRecordsService,
            { provide: EntityEngineService, useValue: engine },
            { provide: EntityMutationService, useValue: mutations },
        ],
    }).compile()
    return { service: moduleRef.get(AgentGraphRecordsService), engine, mutations }
}

const queryOf = (engine: ReturnType<typeof mock<EntityEngineService>>, at = -1): Query => {
    const call = engine.list.mock.calls.at(at)
    if (call === undefined) throw new AgentGraphsError({ code: AgentGraphsErrorCode.RecordUnreadable })
    return call[1]
}

const written = (row: RecordRow, created = false): EngineResult => ({ ok: true, row, version: row.version, created })

const refused = async (work: Promise<unknown>): Promise<unknown> => {
    try {
        await work
        return null
    } catch (cause) {
        return cause instanceof AgentGraphsError ? cause.code : cause
    }
}

describe("AgentGraphRecordsService graphs", () => {
    it("reads the graph of an agent through the agent index, or of an installation through its own", async () => {
        const { service, engine } = await build()
        engine.list.mockResolvedValue(pageOf([graphEngineRow()]))

        await expect(service.graphOf(SCOPE, "agent-1")).resolves.toMatchObject({
            id: "graph-1",
            fence: "4",
            agentId: "agent-1",
            mode: "enforced",
            modeSetAt: null,
        })
        expect(queryOf(engine)).toMatchObject({
            from: "agent.graph",
            where: { op: "eq", field: "agentId", value: "agent-1" },
            order: [["id", "asc"]],
            page: { size: 1 },
        })
        await service.graphOfInstallation(SCOPE, "inst-1")
        expect(queryOf(engine).where).toEqual({ op: "eq", field: "installationId", value: "inst-1" })
    })

    it("answers nothing for an agent or installation with no graph", async () => {
        const { service, engine } = await build()
        engine.list.mockResolvedValue(pageOf([]))

        await expect(service.graphOf(SCOPE, "agent-1")).resolves.toBeNull()
        await expect(service.graphOfInstallation(SCOPE, "inst-1")).resolves.toBeNull()
    })

    it("names which of some agents hold a graph, ordered by agent", async () => {
        const { service, engine } = await build()
        engine.list.mockResolvedValue(pageOf([graphEngineRow()]))

        await expect(service.agentsWithGraph(SCOPE, ["agent-1", "agent-2"])).resolves.toEqual(["agent-1"])
        expect(queryOf(engine)).toMatchObject({
            where: { op: "in", field: "agentId", values: ["agent-1", "agent-2"] },
            order: [
                ["agentId", "asc"],
                ["id", "asc"],
            ],
            page: { size: 2 },
        })
    })

    it("lists the graphs of the workspace with no filter, ordered by agent", async () => {
        const { service, engine } = await build()
        engine.list.mockResolvedValue(pageOf([graphEngineRow()]))

        await expect(service.graphsOfWorkspace(SCOPE, 100)).resolves.toHaveLength(1)
        expect(queryOf(engine).where).toBeUndefined()
    })
})

describe("AgentGraphRecordsService graph writes", () => {
    it("finds or makes a graph under the match key of its agent, and says whether it made it", async () => {
        const { service, mutations } = await build()
        mutations.mutate
            .mockResolvedValueOnce(written(graphEngineRow(), true))
            .mockResolvedValueOnce(written(graphEngineRow()))

        await expect(service.ensureGraph(SCOPE, { agentId: "agent-1" })).resolves.toMatchObject({ created: true })
        await expect(service.ensureGraph(SCOPE, { agentId: "agent-1" })).resolves.toMatchObject({ created: false })
        expect(mutations.mutate).toHaveBeenCalledWith(
            SCOPE,
            { op: "ensure", entity: "agent.graph", match: "agent", values: { agentId: "agent-1" } },
            "job",
        )
    })

    it("writes a graph under the version the caller read, and answers null when it moved on", async () => {
        const { service, mutations } = await build()
        mutations.mutate
            .mockResolvedValueOnce(written(graphEngineRow({ draftRev: 4 })))
            .mockResolvedValueOnce({ ok: false, reason: "stale" })

        await expect(service.patchGraph(SCOPE, graphRow(), { draftRev: 4 })).resolves.toMatchObject({ draftRev: 4 })
        await expect(service.patchGraph(SCOPE, graphRow(), { draftRev: 4 })).resolves.toBeNull()
        expect(mutations.mutate).toHaveBeenCalledWith(
            SCOPE,
            { op: "update", entity: "agent.graph", key: "graph-1", expected: "4", values: { draftRev: 4 } },
            "job",
        )
    })

    it("refuses what the engine refuses for a reason it cannot read", async () => {
        const { service, mutations } = await build()
        mutations.mutate.mockResolvedValue({ ok: false, reason: "invalid" })

        expect(await refused(service.patchGraph(SCOPE, graphRow(), {}))).toBe(AgentGraphsErrorCode.RecordUnreadable)
        expect(await refused(service.ensureGraph(SCOPE, {}))).toBe(AgentGraphsErrorCode.RecordUnreadable)
        expect(await refused(service.insertSource(SCOPE, {}))).toBe(AgentGraphsErrorCode.RecordUnreadable)
        expect(await refused(service.raiseProposal(SCOPE, {}))).toBe(AgentGraphsErrorCode.RecordUnreadable)
        expect(await refused(service.recordDecision(SCOPE, "dedupe", {}))).toBe(AgentGraphsErrorCode.RecordUnreadable)
    })
})

describe("AgentGraphRecordsService versions and sources", () => {
    it("reads a version by id, or null", async () => {
        const { service, engine } = await build()
        engine.get.mockResolvedValueOnce(versionEngineRow()).mockResolvedValueOnce(null)

        await expect(service.version(SCOPE, "version-1")).resolves.toMatchObject({
            id: "version-1",
            number: 2,
            changeKind: "edit",
            publishedAt: new Date("2026-11-01T01:00:00.000Z"),
        })
        await expect(service.version(SCOPE, "version-2")).resolves.toBeNull()
        expect(engine.get).toHaveBeenCalledWith(SCOPE, "agent.graph-version", "version-1")
    })

    it("lists the versions of an agent newest first through the version index", async () => {
        const { service, engine } = await build()
        engine.list.mockResolvedValue(pageOf([versionEngineRow()]))

        await expect(service.versionsOf(SCOPE, "agent-1", 100)).resolves.toHaveLength(1)
        expect(queryOf(engine)).toMatchObject({
            from: "agent.graph-version",
            order: [
                ["number", "desc"],
                ["id", "desc"],
            ],
        })
        await expect(service.latestVersion(SCOPE, "agent-1")).resolves.toMatchObject({ number: 2 })
        expect(queryOf(engine).page).toEqual({ size: 1 })
    })

    it("answers no latest version for an agent with none", async () => {
        const { service, engine } = await build()
        engine.list.mockResolvedValue(pageOf([]))

        await expect(service.latestVersion(SCOPE, "agent-1")).resolves.toBeNull()
    })
})

describe("AgentGraphRecordsService long lists", () => {
    it("follows the cursor of a long list until the limit is reached, a page at a time", async () => {
        const { service, engine } = await build()
        const rows = Array.from({ length: 100 }, () => versionEngineRow())
        engine.list
            .mockResolvedValueOnce(pageOf(rows, "cursor-1"))
            .mockResolvedValueOnce(pageOf(rows.slice(0, 50), "cursor-2"))

        await expect(service.versionsOf(SCOPE, "agent-1", 150)).resolves.toHaveLength(150)
        expect(queryOf(engine, 0).page).toEqual({ size: 100 })
        expect(queryOf(engine, 1).page).toEqual({ size: 50, after: "cursor-1" })
    })

    it("stops when the list ends before the limit", async () => {
        const { service, engine } = await build()
        engine.list.mockResolvedValueOnce(pageOf([versionEngineRow()], null))

        await expect(service.versionsOf(SCOPE, "agent-1", 150)).resolves.toHaveLength(1)
        expect(engine.list).toHaveBeenCalledTimes(1)
    })

    it("inserts a version, and answers null when its number is already the agent's", async () => {
        const { service, mutations } = await build()
        mutations.mutate.mockResolvedValueOnce(written(versionEngineRow())).mockResolvedValueOnce({
            ok: false,
            reason: "taken",
            constraint: "agent_version_key",
            refusal: "version-taken",
        })

        await expect(service.insertVersion(SCOPE, { number: 2 })).resolves.toMatchObject({ number: 2 })
        await expect(service.insertVersion(SCOPE, { number: 2 })).resolves.toBeNull()
    })

    it("indexes a source and reads the sources of one kind among some versions through the kind index", async () => {
        const { service, engine, mutations } = await build()
        mutations.mutate.mockResolvedValue(written(sourceEngineRow()))
        engine.list.mockResolvedValue(pageOf([sourceEngineRow()]))

        await service.insertSource(SCOPE, { kind: "brain" })
        await expect(service.sourcesOf(SCOPE, "brain", ["version-1"], 500)).resolves.toEqual([
            {
                workspaceId: "ws-1",
                versionId: "version-1",
                agentId: "agent-1",
                nodeKey: "decide",
                branchKey: "",
                kind: "brain",
                ref: "fact-1",
                valueHash: "hash",
            },
        ])
        expect(queryOf(engine)).toMatchObject({
            from: "agent.graph-source",
            where: {
                op: "and",
                of: [
                    { op: "eq", field: "kind", value: "brain" },
                    { op: "in", field: "versionId", values: ["version-1"] },
                ],
            },
            order: [
                ["versionId", "asc"],
                ["id", "asc"],
            ],
        })
    })
})

describe("AgentGraphRecordsService proposals", () => {
    it("reads a proposal by id, or null", async () => {
        const { service, engine } = await build()
        engine.get.mockResolvedValueOnce(proposalEngineRow()).mockResolvedValueOnce(null)

        await expect(service.proposal(SCOPE, "p1")).resolves.toMatchObject({
            id: "p1",
            kind: "learned",
            evidence: ["d0"],
            createdAt: new Date("2026-11-01T01:00:00.000Z"),
        })
        await expect(service.proposal(SCOPE, "p2")).resolves.toBeNull()
    })

    it("lists the open proposals of an agent newest first, and the spent ones of a kind by status", async () => {
        const { service, engine } = await build()
        engine.list.mockResolvedValue(pageOf([proposalEngineRow()]))

        await service.openProposalsOf(SCOPE, "agent-1", 100)
        expect(queryOf(engine)).toMatchObject({
            where: {
                op: "and",
                of: [
                    { op: "eq", field: "agentId", value: "agent-1" },
                    { op: "eq", field: "status", value: "open" },
                ],
            },
            order: [
                ["createdAt", "desc"],
                ["id", "desc"],
            ],
        })
        await service.spentProposalsOf(SCOPE, "agent-1", "learned", 1000)
        expect(queryOf(engine)).toMatchObject({
            where: {
                op: "and",
                of: [
                    { op: "eq", field: "agentId", value: "agent-1" },
                    { op: "eq", field: "kind", value: "learned" },
                    { op: "in", field: "status", values: ["open", "confirmed", "declined"] },
                ],
            },
            order: [
                ["status", "asc"],
                ["id", "asc"],
            ],
        })
    })

    it("raises a proposal once per cause under the match key, and says whether this call wrote it", async () => {
        const { service, mutations } = await build()
        mutations.mutate
            .mockResolvedValueOnce(written(proposalEngineRow(), true))
            .mockResolvedValueOnce(written(proposalEngineRow()))

        await expect(service.raiseProposal(SCOPE, { dedupeKey: "k" })).resolves.toBe(true)
        await expect(service.raiseProposal(SCOPE, { dedupeKey: "k" })).resolves.toBe(false)
        expect(mutations.mutate).toHaveBeenCalledWith(
            SCOPE,
            { op: "ensure", entity: "agent.graph-proposal", match: "agent_dedupe", values: { dedupeKey: "k" } },
            "job",
        )
    })

    it("writes a proposal under the version the caller read, and answers null when it moved on", async () => {
        const { service, mutations } = await build()
        mutations.mutate
            .mockResolvedValueOnce(written(proposalEngineRow({ status: "declined" })))
            .mockResolvedValueOnce({ ok: false, reason: "stale" })

        await expect(service.patchProposal(SCOPE, proposalRow(), { status: "declined" })).resolves.toMatchObject({
            status: "declined",
        })
        await expect(service.patchProposal(SCOPE, proposalRow(), { status: "declined" })).resolves.toBeNull()
    })
})

describe("AgentGraphRecordsService decisions", () => {
    it("reads a decision by id, by work item and by open request", async () => {
        const { service, engine } = await build()
        engine.get.mockResolvedValueOnce(decisionEngineRow()).mockResolvedValueOnce(null)
        engine.list.mockResolvedValue(pageOf([decisionEngineRow()]))

        await expect(service.decision(SCOPE, "decision-1")).resolves.toMatchObject({
            id: "decision-1",
            path: ["decide", "middle"],
            unread: [],
            facts: { "supplier_payment.amount_vnd": 7_200_000 },
            closedAs: null,
        })
        await expect(service.decision(SCOPE, "decision-2")).resolves.toBeNull()
        await expect(service.decisionOfItem(SCOPE, "item-9")).resolves.toMatchObject({ workItemId: "item-9" })
        expect(queryOf(engine).where).toEqual({ op: "eq", field: "workItemId", value: "item-9" })
        await expect(service.decisionOfRequest(SCOPE, "request-1")).resolves.toMatchObject({
            approvalRequestId: "request-1",
        })
        expect(queryOf(engine).where).toEqual({ op: "eq", field: "approvalRequestId", value: "request-1" })
    })

    it("answers nothing for an item or request with no decision", async () => {
        const { service, engine } = await build()
        engine.list.mockResolvedValue(pageOf([]))

        await expect(service.decisionOfItem(SCOPE, "item-9")).resolves.toBeNull()
        await expect(service.decisionOfRequest(SCOPE, "request-1")).resolves.toBeNull()
    })
})

describe("AgentGraphRecordsService decision lists", () => {
    it("lists the latest decisions of an agent, and the ones that ended after a moment, newest first", async () => {
        const { service, engine } = await build()
        engine.list.mockResolvedValue(pageOf([decisionEngineRow({ closedAs: "approved" })]))
        const since = new Date("2026-10-30T00:00:00.000Z")

        await service.decisionsOf(SCOPE, "agent-1", 30)
        expect(queryOf(engine)).toMatchObject({
            where: { op: "eq", field: "agentId", value: "agent-1" },
            order: [
                ["createdAt", "desc"],
                ["id", "desc"],
            ],
            page: { size: 30 },
        })
        await expect(service.decisionsClosedSince(SCOPE, since, 500)).resolves.toMatchObject([{ closedAs: "approved" }])
        expect(queryOf(engine)).toMatchObject({
            where: {
                op: "and",
                of: [
                    { op: "notNull", field: "closedAs" },
                    { op: "gt", field: "updatedAt", value: "2026-10-30T00:00:00.000Z" },
                ],
            },
            order: [
                ["updatedAt", "desc"],
                ["id", "desc"],
            ],
        })
    })

    it("records a decision once under the match key it names, and writes one under the version the caller read", async () => {
        const { service, mutations } = await build()
        mutations.mutate
            .mockResolvedValueOnce(written(decisionEngineRow()))
            .mockResolvedValueOnce(written(decisionEngineRow({ closedAs: "done" })))
            .mockResolvedValueOnce({ ok: false, reason: "stale" })

        await expect(service.recordDecision(SCOPE, "work_item", { workItemId: "item-9" })).resolves.toMatchObject({
            id: "decision-1",
        })
        await expect(service.patchDecision(SCOPE, decisionRow(), { closedAs: "done" })).resolves.toMatchObject({
            closedAs: "done",
        })
        await expect(service.patchDecision(SCOPE, decisionRow(), { closedAs: "done" })).resolves.toBeNull()
        expect(mutations.mutate).toHaveBeenCalledWith(
            SCOPE,
            { op: "ensure", entity: "agent.graph-decision", match: "work_item", values: { workItemId: "item-9" } },
            "job",
        )
    })
})
