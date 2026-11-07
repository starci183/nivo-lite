import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import {
    OWNER_EXAMPLE,
    ROW_TIME,
    UNREADABLE_DOCUMENT,
    graphOf,
    graphRow,
    versionRow,
} from "@tests/fixtures/builders/agent-graph.builder"
import { SCOPE, wireScope } from "@tests/fixtures/builders/agent-graph-records.builder"
import { CLOCK } from "@modules/platform/clock"
import { EntityEngineService } from "@modules/domain/entity-engine"
import { AgentGraphRecordsService } from "./agent-graph-records.service"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import { AgentGraphsService } from "./agent-graphs.service"
import type { GraphSourceRecord } from "./agent-graphs-records.contracts"

const { DocumentInvalid, DraftConflict, GraphNotFound, VersionNotFound } = AgentGraphsErrorCode

const DOCUMENT = graphOf(OWNER_EXAMPLE)

const build = async () => {
    const engine = mock<EntityEngineService>()
    wireScope(engine)
    const records = mock<AgentGraphRecordsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphsService,
            { provide: EntityEngineService, useValue: engine },
            { provide: AgentGraphRecordsService, useValue: records },
            { provide: CLOCK, useValue: new FakeClock("2026-11-01T02:00:00.000Z") },
        ],
    }).compile()
    return { service: moduleRef.get(AgentGraphsService), engine, records }
}

/** The service over a graph (enforced unless named) whose live version is `version`. */
const liveAt = async (version: ReturnType<typeof versionRow>, graph = graphRow("enforced")) => {
    const built = await build()
    built.records.graphOf.mockResolvedValue(graph)
    built.records.graphOfInstallation.mockResolvedValue(graph)
    built.records.version.mockResolvedValue(version)
    return built
}

const codeOf = async (work: Promise<unknown>): Promise<unknown> => {
    try {
        await work
        return null
    } catch (cause) {
        return cause instanceof AgentGraphsError ? cause.code : cause
    }
}

describe("AgentGraphsService reads", () => {
    it("reads the graph of an installation or an agent with the version that decides", async () => {
        const { service, engine, records } = await liveAt(versionRow())

        const byInstallation = await service.stateOfInstallation("ws-1", "inst-1")
        const byAgent = await service.stateOfAgent("ws-1", "agent-1")

        expect(byInstallation).toEqual({
            workspaceId: "ws-1",
            agentId: "agent-1",
            installationId: "inst-1",
            mode: "enforced",
            draft: DOCUMENT,
            draftRev: 3,
            activeVersionId: "version-1",
            active: DOCUMENT,
            activeKind: "edit",
        })
        expect(byAgent?.agentId).toBe("agent-1")
        expect(records.graphOfInstallation).toHaveBeenCalledWith(SCOPE, "inst-1")
        expect(records.version).toHaveBeenCalledWith(SCOPE, "version-1")
        expect(engine.scoped).toHaveBeenCalledWith("ws-1", expect.any(Function))
    })

    it("answers nothing for an agent with no graph, has no active graph before the first version, and none when it cannot be read", async () => {
        const fresh = await build()
        fresh.records.graphOf.mockResolvedValue(graphRow("shadow", null))
        const broken = await liveAt(versionRow(2, UNREADABLE_DOCUMENT), graphRow())
        const none = await build()
        none.records.graphOf.mockResolvedValue(null)
        none.records.graphOfInstallation.mockResolvedValue(null)

        await expect(fresh.service.stateOfAgent("ws-1", "agent-1")).resolves.toMatchObject({
            active: null,
            activeVersionId: null,
            activeKind: null,
        })
        await expect(broken.service.stateOfAgent("ws-1", "agent-1")).resolves.toMatchObject({ active: null })
        await expect(none.service.stateOfInstallation("ws-1", "inst-1")).resolves.toBeNull()
        await expect(none.service.stateOfAgent("ws-1", "agent-1")).resolves.toBeNull()
    })

    it("is no graph at all when the draft cannot be read", async () => {
        const { service, records } = await build()
        records.graphOf.mockResolvedValue(graphRow("shadow", "version-1", UNREADABLE_DOCUMENT))

        await expect(service.stateOfAgent("ws-1", "agent-1")).resolves.toBeNull()
    })
})

describe("AgentGraphsService versions", () => {
    it("lists the versions newest first", async () => {
        const { service, records } = await build()
        records.versionsOf.mockResolvedValue([versionRow(), versionRow(1, DOCUMENT, "version-0")])

        await expect(service.versionsOf("ws-1", "agent-1")).resolves.toEqual([
            {
                id: "version-1",
                version: 2,
                changeKind: "edit",
                note: "Raised the bound",
                publishedAt: ROW_TIME.toISOString(),
                publishedBy: "member-1",
            },
            expect.objectContaining({ id: "version-0", version: 1 }),
        ])
        expect(records.versionsOf).toHaveBeenCalledWith(SCOPE, "agent-1", 100)
    })

    it("answers the number of the newest version, and 0 before the first", async () => {
        const { service, records } = await build()
        records.latestVersion.mockResolvedValueOnce(versionRow(7)).mockResolvedValueOnce(null)

        await expect(service.latestVersionOf("ws-1", "agent-1")).resolves.toBe(7)
        await expect(service.latestVersionOf("ws-1", "agent-1")).resolves.toBe(0)
    })

    it("opens one version as a graph, and refuses one that is not the agent or cannot be read", async () => {
        const { service, records } = await build()
        records.version
            .mockResolvedValueOnce(versionRow())
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ ...versionRow(), agentId: "agent-2" })
            .mockResolvedValueOnce(versionRow(2, UNREADABLE_DOCUMENT))

        await expect(service.documentOf("ws-1", "agent-1", "version-1")).resolves.toEqual(DOCUMENT)
        expect(await codeOf(service.documentOf("ws-1", "agent-1", "version-9"))).toBe(VersionNotFound)
        expect(await codeOf(service.documentOf("ws-1", "agent-1", "version-2"))).toBe(VersionNotFound)
        expect(await codeOf(service.documentOf("ws-1", "agent-1", "version-1"))).toBe(DocumentInvalid)
    })
})

describe("AgentGraphsService.approverOf", () => {
    const decision = {
        id: "decision-1",
        workspaceId: "ws-1",
        agentId: "agent-1",
        workItemId: "item-9",
        versionId: "version-1",
        action: "pay_supplier",
        branchKey: "middle",
        path: ["decide", "middle"],
        amount: 7_200_000,
        approvalRequestId: null,
        closed: false,
    }

    it("names the approver the branch of a decision had in the version that decided, or nobody", async () => {
        const { service } = await liveAt(versionRow())

        await expect(service.approverOf(decision)).resolves.toMatchObject({ policy: "any", timeoutMinutes: 240 })
        await expect(service.approverOf({ ...decision, branchKey: "small" })).resolves.toBeNull()
    })
})

describe("AgentGraphsService for a job that walks the agents of a workspace", () => {
    it("names, of some agents, the ones with no graph, and reads nothing for an empty list", async () => {
        const { service, engine, records } = await build()
        records.agentsWithGraph.mockResolvedValue(["agent-1"])

        await expect(service.missingGraph("ws-1", ["agent-1", "agent-2"])).resolves.toEqual(["agent-2"])
        await expect(service.missingGraph("ws-1", [])).resolves.toEqual([])
        expect(records.agentsWithGraph).toHaveBeenCalledWith(SCOPE, ["agent-1", "agent-2"])
        expect(engine.scoped).toHaveBeenCalledTimes(1)
    })

    it("asks the engine about the agents in runs of at most a hundred", async () => {
        const { service, records } = await build()
        records.agentsWithGraph.mockResolvedValue([])
        const agents = Array.from({ length: 250 }, (_unused, index) => `agent-${index}`)

        await expect(service.missingGraph("ws-1", agents)).resolves.toHaveLength(250)
        expect(records.agentsWithGraph.mock.calls.map((call) => call[1].length)).toEqual([100, 100, 50])
    })

    it("reads the Brain rules behind the versions that decide in a workspace", async () => {
        const { service, records } = await build()
        const source: GraphSourceRecord = {
            workspaceId: "ws-1",
            versionId: "version-1",
            agentId: "agent-1",
            nodeKey: "decide",
            branchKey: "middle",
            kind: "brain",
            ref: "fact-1",
            valueHash: "hash-1",
        }
        records.graphsOfWorkspace.mockResolvedValue([graphRow("enforced", "version-1"), graphRow("enforced", null)])
        records.sourcesOf.mockResolvedValue([source])

        await expect(service.brainSourcesInForce("ws-1", 500)).resolves.toEqual([
            {
                workspaceId: "ws-1",
                agentId: "agent-1",
                versionId: "version-1",
                nodeKey: "decide",
                branchKey: "middle",
                factId: "fact-1",
                valueHash: "hash-1",
            },
        ])
        expect(records.sourcesOf).toHaveBeenCalledWith(SCOPE, "brain", ["version-1"], 500)
    })

    it("reads no source when no graph of the workspace has a version in force", async () => {
        const { service, records } = await build()
        records.graphsOfWorkspace.mockResolvedValue([graphRow("enforced", null)])

        await expect(service.brainSourcesInForce("ws-1", 500)).resolves.toEqual([])
        expect(records.sourcesOf).not.toHaveBeenCalled()
    })
})

describe("AgentGraphsService.versionAt", () => {
    it("opens one version with its number and its graph, and refuses one that is not the agent or cannot be read", async () => {
        const { service, records } = await build()
        records.version
            .mockResolvedValueOnce(versionRow(4))
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(versionRow(2, UNREADABLE_DOCUMENT))

        await expect(service.versionAt("ws-1", "agent-1", "version-1")).resolves.toEqual({
            version: 4,
            document: DOCUMENT,
        })
        expect(await codeOf(service.versionAt("ws-1", "agent-1", "v"))).toBe(VersionNotFound)
        expect(await codeOf(service.versionAt("ws-1", "agent-1", "v"))).toBe(DocumentInvalid)
    })
})

describe("AgentGraphsService.saveDraft", () => {
    it("saves the draft under the revision it read and moves the revision on", async () => {
        const { service, records } = await build()
        const before = graphRow("shadow", null, DOCUMENT, 3)
        const after = graphRow("shadow", null, DOCUMENT, 4)
        records.graphOf.mockResolvedValue(before)
        records.patchGraph.mockResolvedValue(after)

        await expect(service.saveDraft("ws-1", "agent-1", 3, DOCUMENT)).resolves.toMatchObject({ draftRev: 4 })

        expect(records.patchGraph).toHaveBeenCalledWith(SCOPE, before, { draft: DOCUMENT, draftRev: 4 })
    })

    it("refuses a save when someone saved after the draft was read, or the graph moved meanwhile, and a draft the product cannot read before it touches the store", async () => {
        const stale = await build()
        stale.records.graphOf.mockResolvedValue(graphRow("shadow", null, DOCUMENT, 5))
        const raced = await build()
        raced.records.graphOf.mockResolvedValue(graphRow("shadow", null, DOCUMENT, 3))
        raced.records.patchGraph.mockResolvedValue(null)
        const gone = await build()
        gone.records.graphOf.mockResolvedValue(null)
        const reading = await build()

        expect(await codeOf(stale.service.saveDraft("ws-1", "agent-1", 3, DOCUMENT))).toBe(DraftConflict)
        expect(await codeOf(raced.service.saveDraft("ws-1", "agent-1", 3, DOCUMENT))).toBe(DraftConflict)
        expect(await codeOf(gone.service.saveDraft("ws-1", "agent-1", 3, DOCUMENT))).toBe(DraftConflict)
        expect(await codeOf(reading.service.saveDraft("ws-1", "agent-1", 3, UNREADABLE_DOCUMENT))).toBe(DocumentInvalid)
        expect(reading.engine.scoped).not.toHaveBeenCalled()
    })

    it("refuses when the saved graph cannot be read back", async () => {
        const { service, records } = await build()
        records.graphOf.mockResolvedValue(graphRow("shadow", null, DOCUMENT, 3))
        records.patchGraph.mockResolvedValue(graphRow("shadow", null, UNREADABLE_DOCUMENT, 4))

        expect(await codeOf(service.saveDraft("ws-1", "agent-1", 3, DOCUMENT))).toBe(GraphNotFound)
    })
})

describe("AgentGraphsService.setMode", () => {
    it("sets whether the graph decides or only records, and keeps who set it and when", async () => {
        const { service, records } = await build()
        const before = graphRow("shadow", null)
        records.graphOf.mockResolvedValue(before)
        records.patchGraph.mockResolvedValue(graphRow("enforced", null))

        await expect(service.setMode("ws-1", "agent-1", "enforced", "member-1")).resolves.toMatchObject({
            mode: "enforced",
        })
        expect(records.patchGraph).toHaveBeenCalledWith(SCOPE, before, {
            mode: "enforced",
            modeSetBy: "member-1",
            modeSetAt: "2026-11-01T02:00:00.000Z",
        })
    })

    it("refuses an agent with no graph, one whose graph moved meanwhile and one that cannot be read after the change", async () => {
        const none = await build()
        none.records.graphOf.mockResolvedValue(null)
        const raced = await build()
        raced.records.graphOf.mockResolvedValue(graphRow())
        raced.records.patchGraph.mockResolvedValue(null)
        const gone = await build()
        gone.records.graphOf.mockResolvedValue(graphRow())
        gone.records.patchGraph.mockResolvedValue(graphRow("shadow", null, UNREADABLE_DOCUMENT))

        expect(await codeOf(none.service.setMode("ws-1", "agent-1", "shadow", "member-1"))).toBe(GraphNotFound)
        expect(await codeOf(raced.service.setMode("ws-1", "agent-1", "shadow", "member-1"))).toBe(DraftConflict)
        expect(await codeOf(gone.service.setMode("ws-1", "agent-1", "shadow", "member-1"))).toBe(GraphNotFound)
    })
})

const input = {
    workspaceId: "ws-1",
    agentId: "agent-1",
    document: DOCUMENT,
    kind: "edit",
    note: "Raised the bound",
    memberId: "member-1",
    contextVersionId: null,
} as const

describe("AgentGraphsService.publish", () => {
    it("freezes the next version, indexes its sources, makes it the one that decides and keeps the draft in step", async () => {
        const { service, records } = await build()
        const graph = graphRow()
        records.graphOf.mockResolvedValue(graph)
        records.latestVersion.mockResolvedValue(versionRow(2))
        records.insertVersion.mockResolvedValue(versionRow(3, DOCUMENT, "version-3"))
        records.patchGraph.mockResolvedValue(graphRow())

        await expect(service.publish(input)).resolves.toMatchObject({ id: "version-3", version: 3, changeKind: "edit" })

        expect(records.insertVersion).toHaveBeenCalledWith(
            SCOPE,
            expect.objectContaining({ agentId: "agent-1", number: 3, changeKind: "edit", publishedBy: "member-1" }),
        )
        expect(records.insertSource).toHaveBeenCalledWith(
            SCOPE,
            expect.objectContaining({ versionId: "version-3", kind: "rule", ref: "pay_supplier" }),
        )
        expect(records.patchGraph).toHaveBeenCalledWith(SCOPE, graph, {
            activeVersionId: "version-3",
            draft: DOCUMENT,
            draftRev: 4,
        })
    })

    it("indexes nothing for a graph that cites no source", async () => {
        const { service, records } = await build()
        records.graphOf.mockResolvedValue(graphRow())
        records.latestVersion.mockResolvedValue(null)
        records.insertVersion.mockResolvedValue(versionRow(1))
        records.patchGraph.mockResolvedValue(graphRow())

        await service.publish({ ...input, document: { nodes: [], rights: [] } })

        expect(records.insertSource).not.toHaveBeenCalled()
        expect(records.insertVersion).toHaveBeenCalledWith(SCOPE, expect.objectContaining({ number: 1 }))
    })

    it("refuses a graph that cannot be read, an agent with no graph, a number another publish took and a graph that moved meanwhile", async () => {
        const { service, records } = await build()
        records.graphOf.mockResolvedValueOnce(null).mockResolvedValue(graphRow())
        records.latestVersion.mockResolvedValue(null)
        records.insertVersion.mockResolvedValueOnce(null).mockResolvedValue(versionRow(1))
        records.patchGraph.mockResolvedValue(null)

        expect(await codeOf(service.publish({ ...input, document: UNREADABLE_DOCUMENT }))).toBe(DocumentInvalid)
        expect(await codeOf(service.publish(input))).toBe(GraphNotFound)
        expect(await codeOf(service.publish(input))).toBe(DraftConflict)
        expect(await codeOf(service.publish(input))).toBe(DraftConflict)
    })
})

describe("AgentGraphsService.publish with a number", () => {
    it("takes the number it is given when that is above the newest, and refuses one that is not", async () => {
        const { service, records } = await build()
        records.graphOf.mockResolvedValue(graphRow())
        records.latestVersion.mockResolvedValue(versionRow(5))
        records.insertVersion.mockResolvedValue(versionRow(7, DOCUMENT, "version-7"))
        records.patchGraph.mockResolvedValue(graphRow())

        await expect(service.publish({ ...input, version: 7 })).resolves.toMatchObject({ id: "version-7", version: 7 })
        expect(records.insertVersion).toHaveBeenCalledWith(SCOPE, expect.objectContaining({ number: 7 }))
        expect(await codeOf(service.publish({ ...input, version: 5 }))).toBe(DraftConflict)
    })
})

describe("AgentGraphsService.ensure", () => {
    it("leaves an agent that has a graph as it is", async () => {
        const { service, engine } = await liveAt(versionRow())

        await expect(service.ensure("ws-1", "agent-1", "inst-1", DOCUMENT)).resolves.toMatchObject({
            agentId: "agent-1",
        })
        expect(engine.scoped).toHaveBeenCalledTimes(1)
    })

    it("writes the draft and version 1 as the seed, enforced from the start, for an agent with none", async () => {
        const { service, records } = await build()
        const graph = graphRow("enforced", null, DOCUMENT, 1)
        records.graphOf.mockResolvedValueOnce(null).mockResolvedValue(graphRow("enforced", "version-1", DOCUMENT, 1))
        records.version.mockResolvedValue(versionRow(1, DOCUMENT, "version-1", "seed"))
        records.ensureGraph.mockResolvedValue({ graph, created: true })
        records.latestVersion.mockResolvedValue(null)
        records.insertVersion.mockResolvedValue(versionRow(1, DOCUMENT, "version-1", "seed"))

        await service.ensure("ws-1", "agent-1", "inst-1", DOCUMENT)

        expect(records.ensureGraph).toHaveBeenCalledWith(SCOPE, {
            agentId: "agent-1",
            installationId: "inst-1",
            draft: DOCUMENT,
            draftRev: 1,
            mode: "enforced",
        })
        expect(records.insertVersion).toHaveBeenCalledWith(
            SCOPE,
            expect.objectContaining({ number: 1, changeKind: "seed", publishedBy: null }),
        )
        expect(records.patchGraph).toHaveBeenCalledWith(SCOPE, graph, { activeVersionId: "version-1" })
    })

    it("writes no second seed when another worker wrote it first", async () => {
        const { service, records } = await build()
        records.graphOf.mockResolvedValueOnce(null).mockResolvedValue(graphRow())
        records.version.mockResolvedValue(versionRow())
        records.ensureGraph.mockResolvedValue({ graph: graphRow(), created: false })
        records.latestVersion.mockResolvedValue(versionRow(1))

        await service.ensure("ws-1", "agent-1", "inst-1", DOCUMENT)

        expect(records.insertVersion).not.toHaveBeenCalled()
    })

    it("refuses when the graph still cannot be read after it was written", async () => {
        const { service, records } = await build()
        records.graphOf.mockResolvedValue(null)
        records.ensureGraph.mockResolvedValue({ graph: graphRow(), created: false })
        records.latestVersion.mockResolvedValue(versionRow(1))

        expect(await codeOf(service.ensure("ws-1", "agent-1", "inst-1", DOCUMENT))).toBe(GraphNotFound)
    })
})

describe("AgentGraphsService.activeVersionIdOf", () => {
    it("answers the id of the version that decides, reading no document, and none for an agent with no graph or no version", async () => {
        const { service, records } = await build()
        records.graphOf
            .mockResolvedValueOnce(graphRow("enforced"))
            .mockResolvedValueOnce(graphRow("enforced", null))
            .mockResolvedValueOnce(null)

        await expect(service.activeVersionIdOf("ws-1", "agent-1")).resolves.toBe("version-1")
        await expect(service.activeVersionIdOf("ws-1", "agent-1")).resolves.toBeNull()
        await expect(service.activeVersionIdOf("ws-1", "agent-1")).resolves.toBeNull()
        expect(records.version).not.toHaveBeenCalled()
    })
})

const FLOW: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "chatbot",
    trigger: { kind: "tag", sources: ["channel"] },
    grant: { rights: [], tools: [], effects: [] },
    nodes: [{ key: "end", kind: "output", step: "stop" }],
}

describe("AgentGraphsService.hasLiveFlow", () => {
    it("is true when the live version carries a flow of nodes, false with none or with no graph", async () => {
        const withFlow = await liveAt(versionRow(2, { ...DOCUMENT, flow: FLOW }))
        const rulesOnly = await liveAt(versionRow())
        const noGraph = await build()
        noGraph.records.graphOf.mockResolvedValue(null)

        await expect(withFlow.service.hasLiveFlow("ws-1", "agent-1")).resolves.toBe(true)
        await expect(rulesOnly.service.hasLiveFlow("ws-1", "agent-1")).resolves.toBe(false)
        await expect(noGraph.service.hasLiveFlow("ws-1", "agent-1")).resolves.toBe(false)
    })
})
