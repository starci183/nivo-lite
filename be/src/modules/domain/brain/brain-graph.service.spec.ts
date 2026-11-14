import { Test } from "@nestjs/testing"
import { FakeClock, builder, mock } from "@starci/jest-preset"
import { BrainFactRelationsService, BrainFactsPagingService, BrainFactsReadService } from "@modules/domain/brain-facts"
import type { FactRecord, FactRelation } from "@modules/domain/brain-facts"
import { BrainExtractionsService } from "@modules/domain/brain-extractions"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { BrainGraphService } from "./brain-graph.service"

const WS = "ws-1"
const NOW = "2026-11-11T10:00:00.000Z"
const DOC = "doc-ship"

const factOf = builder<FactRecord>({
    id: "f1",
    subjectType: "policy",
    subjectKey: "giao-hang",
    subjectLabel: "Giao hang",
    attribute: "phi-ship-noi-thanh",
    attributeLabel: "Phi ship noi thanh",
    value: "30.000 d",
    valueNumber: 30000,
    unit: null,
    scope: "internal",
    modules: [],
    installationId: null,
    status: "active",
    sourceKind: "owner",
    trust: 95,
    validFrom: "2026-11-10T00:00:00.000Z",
    validTo: "2027-11-10T00:00:00.000Z",
    supersedesId: null,
    conflictWith: null,
    proposalKind: "set",
    evidence: [],
    proposedBy: "Ada",
    proposedAt: "2026-11-10T00:00:00.000Z",
    decidedBy: "Ada",
    decidedAt: "2026-11-10T00:00:00.000Z",
    decisionNote: null,
})

const docEvidence = { kind: "document" as const, ref: DOC, label: "Quy dinh giao hang.docx", title: "Quy dinh giao hang.docx", sourceId: DOC, chunkHash: "h-ship", quote: "Phi ship 30.000" }

const ship = factOf({ id: "ship", version: 3, supersedesId: "ship-v2", evidence: [docEvidence] })
const express = factOf({ id: "express", attribute: "hoa-toc", attributeLabel: "Giao hoa toc", value: "noi thanh", decidedAt: "2026-10-01T00:00:00.000Z", evidence: [docEvidence] })
const hours = factOf({ id: "hours", subjectKey: "gio-lam-viec", subjectLabel: "Gio lam viec", attribute: "mo-cua", attributeLabel: "Mo cua", value: "8:00-20:00", decidedAt: "2026-11-01T00:00:00.000Z" })
const previous = factOf({ id: "ship-v2", status: "superseded", value: "20.000 d", version: 2 })
const proposal = factOf({
    id: "p1",
    status: "proposed",
    subjectKey: "giao-hang",
    attribute: "hoa-toc",
    attributeLabel: "Giao hoa toc",
    value: "phu phi 15.000 d sau 18:00",
    proposedBy: "sales",
    sourceKind: "staff",
    decidedAt: null,
    evidence: [{ kind: "message", ref: "team-chat:m1", label: "Private chat with an agent", quote: "them phu phi 15k sau 18h" }],
})
const edge = (id: string, from: string, to: string): FactRelation => ({
    id,
    fromFactId: from,
    toFactId: to,
    kind: "part_of",
    label: "giao bang",
    createdBy: "NIVO",
    createdAt: NOW,
})

const founder: WorkspaceMember = {
    userId: "u1",
    workspaceId: WS,
    role: "owner",
    staffId: null,
    displayName: "Ada",
    status: "active",
}

const build = async () => {
    const members = mock<WorkspaceMembersService>()
    const reads = mock<BrainFactsReadService>()
    const relations = mock<BrainFactRelationsService>()
    const extractions = mock<BrainExtractionsService>()
    members.require.mockResolvedValue(founder)
    reads.list.mockImplementation((_ws, filter) =>
        Promise.resolve(filter.statuses?.includes("proposed") === true ? [proposal] : [ship, express, hours]),
    )
    reads.byIds.mockResolvedValue([previous])
    relations.ofFacts.mockResolvedValue([edge("e1", "express", "ship"), edge("e2", "hours", "ship"), edge("e3", "ship", "gone")])
    extractions.progress.mockResolvedValue([
        {
            sourceId: DOC,
            status: "running",
            windowsDone: 0,
            windowsTotal: 1,
            factsProposed: 0,
            stage: "extract",
            error: null,
            counts: { passagesTotal: 1, passagesTriaged: 1, passagesKept: 1, factsApplied: 0, factsAsked: 0, factsWaiting: 0 },
            windowsSkipped: 0,
            linesRefused: 0,
        },
    ])
    // The SQL counts of the workspace: what the reads above hold (the graph is whole).
    const counts = mock<BrainFactsPagingService>()
    counts.countByStatus.mockResolvedValue(new Map([["active", 3], ["proposed", 1]]))
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainGraphService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: BrainFactsReadService, useValue: reads },
            { provide: BrainFactRelationsService, useValue: relations },
            { provide: BrainExtractionsService, useValue: extractions },
            { provide: BrainFactsPagingService, useValue: counts },
        ],
    }).compile()
    return { service: moduleRef.get(BrainGraphService), members, reads, relations, counts }
}

describe("BrainGraphService: the API of the second-brain picture", () => {
    it("answers the page's nodes with source, version, validity and previous value; neighbours; edges; pending; sources; totals", async () => {
        const { service, members, relations } = await build()

        const graph = await service.graph("u1", { workspaceId: WS, subjectKey: "giao-hang" })

        expect(members.require).toHaveBeenCalledWith("u1", WS, ["owner", "manager"])
        expect(relations.ofFacts).toHaveBeenCalledWith(WS, ["ship", "express", "hours"])
        expect(graph.nodes.map((node) => [node.id, node.neighbor])).toEqual([
            ["ship", false],
            ["express", false],
            ["hours", true],
        ])
        expect(graph.nodes[0]).toMatchObject({
            version: 3,
            validTo: "2027-11-10T00:00:00.000Z",
            previous: { id: "ship-v2", value: "20.000 d", version: 2 },
            origin: { kind: "document", chunkHash: "h-ship" },
            recentlyChanged: true,
            pendingCount: 0,
        })
        expect(graph.nodes[1]).toMatchObject({ recentlyChanged: false, pendingCount: 1 })
        // The edge to a fact that is not in force is not drawn.
        expect(graph.edges.map((entry) => entry.id)).toEqual(["e1", "e2"])
        expect(graph.pending).toHaveLength(1)
        expect(graph.pending[0]).toMatchObject({
            id: "p1",
            currentFactId: "express",
            currentValue: "noi thanh",
            proposedBy: "sales",
            origin: { kind: "chat", messageId: "m1" },
        })
        expect(graph.sources).toEqual([
            {
                sourceId: DOC,
                title: "Quy dinh giao hang.docx",
                nodeCount: 2,
                lastChangedAt: "2026-11-10T00:00:00.000Z",
                reading: { status: "running", windowsDone: 0, windowsTotal: 1, factsProposed: 0 },
            },
        ])
        expect(graph.totals).toEqual({ nodes: 3, relations: 2, recentlyChanged: 1, pending: 1, nodesNotShown: 0, pendingNotShown: 0 })
        expect(graph.nextCursor).toBeNull()
    })

    it("a capped read says it is capped: the totals carry the SQL counts and how many are not shown (BRAIN-LIMITS item 3)", async () => {
        const { service, counts } = await build()
        counts.countByStatus.mockResolvedValue(new Map([["active", 4800], ["scheduled", 200], ["proposed", 2600]]))

        const graph = await service.graph("u1", { workspaceId: WS, subjectKey: "giao-hang" })

        expect(counts.countByStatus).toHaveBeenCalledWith(WS, ["active", "scheduled", "proposed"])
        expect(graph.totals).toMatchObject({ nodes: 5000, nodesNotShown: 4997, pending: 2600, pendingNotShown: 2599 })
    })

    it("lets a manager draw and remove edges under their own name; staff read nothing", async () => {
        const { service, members, relations } = await build()
        relations.link.mockResolvedValue(edge("e9", "express", "ship"))
        relations.unlink.mockResolvedValue(true)

        await service.link("u1", { workspaceId: WS, fromFactId: "express", toFactId: "ship", kind: "part_of", label: "giao bang" })
        await expect(service.unlink("u1", { workspaceId: WS, id: "e9" })).resolves.toBe(true)

        expect(relations.link).toHaveBeenCalledWith(WS, {
            fromFactId: "express",
            toFactId: "ship",
            kind: "part_of",
            label: "giao bang",
            createdBy: "Ada",
        })
        expect(members.require.mock.calls.every((call) => JSON.stringify(call[2]) === '["owner","manager"]')).toBe(true)
    })
})
