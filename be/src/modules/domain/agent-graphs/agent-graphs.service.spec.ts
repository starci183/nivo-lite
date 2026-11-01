import { Test } from "@nestjs/testing"
import { fakeTransaction, mockEntityManager } from "@starci/jest-preset"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import {
    OWNER_EXAMPLE,
    ROW_TIME,
    UNREADABLE_DOCUMENT,
    graphOf,
    graphRow,
    versionRow,
} from "@tests/fixtures/builders/agent-graph.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import { AgentGraphsService } from "./agent-graphs.service"
import { AgentGraphEntity, AgentGraphSourceEntity, AgentGraphVersionEntity } from "./persistence/entities"

const DOCUMENT = graphOf(OWNER_EXAMPLE)

const build = async (em = mockEntityManager()) => {
    const moduleRef = await Test.createTestingModule({
        providers: [AgentGraphsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return moduleRef.get(AgentGraphsService)
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
        const em = mockEntityManager({
            findOne: [
                [AgentGraphEntity, graphRow("enforced")],
                [AgentGraphVersionEntity, versionRow()],
            ],
        })
        const service = await build(em)

        const byInstallation = await service.stateOfInstallation("inst-1")
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
        })
        expect(byAgent?.agentId).toBe("agent-1")
        expect(em.findOne).toHaveBeenCalledWith(AgentGraphEntity, { where: { installationId: "inst-1" } })
    })

    it("answers nothing for an agent with no graph", async () => {
        const service = await build(mockEntityManager({ findOne: [AgentGraphEntity, null] }))

        await expect(service.stateOfInstallation("inst-1")).resolves.toBeNull()
        await expect(service.stateOfAgent("ws-1", "agent-1")).resolves.toBeNull()
    })

    it("has no active graph before the first version, and none when the version cannot be read", async () => {
        const fresh = await build(mockEntityManager({ findOne: [AgentGraphEntity, graphRow("shadow", null)] }))
        const broken = await build(
            mockEntityManager({
                findOne: [
                    [AgentGraphEntity, graphRow()],
                    [AgentGraphVersionEntity, versionRow(2, UNREADABLE_DOCUMENT)],
                ],
            }),
        )

        await expect(fresh.stateOfAgent("ws-1", "agent-1")).resolves.toMatchObject({
            active: null,
            activeVersionId: null,
        })
        await expect(broken.stateOfAgent("ws-1", "agent-1")).resolves.toMatchObject({ active: null })
    })
})

describe("AgentGraphsService reads (continued)", () => {
    it("is no graph at all when the draft cannot be read", async () => {
        const service = await build(
            mockEntityManager({ findOne: [AgentGraphEntity, graphRow("shadow", "version-1", UNREADABLE_DOCUMENT)] }),
        )

        await expect(service.stateOfAgent("ws-1", "agent-1")).resolves.toBeNull()
    })

    it("lists the versions newest first", async () => {
        const em = mockEntityManager({
            find: [AgentGraphVersionEntity, [versionRow(), versionRow(1, DOCUMENT, "version-0")]],
        })
        const service = await build(em)

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
        expect(em.find).toHaveBeenCalledWith(
            AgentGraphVersionEntity,
            expect.objectContaining({ order: { version: "DESC" } }),
        )
    })

    it("opens one version as a graph, and refuses one that is not the agent or cannot be read", async () => {
        const found = await build(mockEntityManager({ findOne: [AgentGraphVersionEntity, versionRow()] }))
        const missing = await build(mockEntityManager({ findOne: [AgentGraphVersionEntity, null] }))
        const broken = await build(
            mockEntityManager({ findOne: [AgentGraphVersionEntity, versionRow(2, UNREADABLE_DOCUMENT)] }),
        )

        await expect(found.documentOf("ws-1", "agent-1", "version-1")).resolves.toEqual(DOCUMENT)
        expect(await codeOf(missing.documentOf("ws-1", "agent-1", "version-9"))).toBe(
            AgentGraphsErrorCode.VersionNotFound,
        )
        expect(await codeOf(broken.documentOf("ws-1", "agent-1", "version-1"))).toBe(
            AgentGraphsErrorCode.DocumentInvalid,
        )
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
        amount: 7_200_000,
        approvalRequestId: null,
        closed: false,
    }

    it("names the approver the branch of a decision had in the version that decided, or nobody", async () => {
        const service = await build(mockEntityManager({ findOne: [AgentGraphVersionEntity, versionRow()] }))

        await expect(service.approverOf(decision)).resolves.toMatchObject({ policy: "any", timeoutMinutes: 240 })
        await expect(service.approverOf({ ...decision, branchKey: "small" })).resolves.toBeNull()
    })
})

describe("AgentGraphsService for a job that walks every agent", () => {
    it("reads the graph of an agent by its id alone, and answers nothing for an agent with none", async () => {
        const found = await build(mockEntityManager({ findOne: [[AgentGraphEntity, graphRow("shadow", null)]] }))
        const none = await build(mockEntityManager({ findOne: [AgentGraphEntity, null] }))

        await expect(found.statesOfAgent("agent-1")).resolves.toMatchObject({ agentId: "agent-1", active: null })
        await expect(none.statesOfAgent("agent-1")).resolves.toBeNull()
    })

    it("names, of some agents, the ones with no graph, and reads nothing for an empty list", async () => {
        const em = mockEntityManager({ find: [AgentGraphEntity, [graphRow()]] })
        const service = await build(em)

        await expect(service.missingGraph(["agent-1", "agent-2"])).resolves.toEqual(["agent-2"])
        await expect(service.missingGraph([])).resolves.toEqual([])
        expect(em.find).toHaveBeenCalledTimes(1)
    })

    it("reads the Brain rules behind the versions that decide", async () => {
        const row = Object.assign(new AgentGraphSourceEntity(), {
            workspaceId: "ws-1",
            agentId: "agent-1",
            versionId: "version-1",
            nodeKey: "decide",
            branchKey: "middle",
            kind: "brain",
            ref: "fact-1",
            valueHash: "hash-1",
        })
        const em = mockEntityManager()
        const [fake] = queueQueryBuilders(em, [{ getMany: [row] }])
        const service = await build(em)

        await expect(service.brainSourcesInForce(500)).resolves.toEqual([
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
        expect(fake?.callsOf("take")).toEqual([[500]])
    })
})

describe("AgentGraphsService.versionAt", () => {
    it("opens one version with its number and its graph", async () => {
        const service = await build(mockEntityManager({ findOne: [AgentGraphVersionEntity, versionRow(4)] }))

        await expect(service.versionAt("ws-1", "agent-1", "version-1")).resolves.toEqual({
            version: 4,
            document: DOCUMENT,
        })
    })

    it("refuses a version that is not the agent or cannot be read", async () => {
        const missing = await build(mockEntityManager({ findOne: [AgentGraphVersionEntity, null] }))
        const broken = await build(
            mockEntityManager({ findOne: [AgentGraphVersionEntity, versionRow(2, UNREADABLE_DOCUMENT)] }),
        )

        expect(await codeOf(missing.versionAt("ws-1", "agent-1", "v"))).toBe(AgentGraphsErrorCode.VersionNotFound)
        expect(await codeOf(broken.versionAt("ws-1", "agent-1", "v"))).toBe(AgentGraphsErrorCode.DocumentInvalid)
    })
})

describe("AgentGraphsService.saveDraft", () => {
    it("saves the draft under the revision it read and moves the revision on", async () => {
        const em = mockEntityManager({
            update: [AgentGraphEntity, { affected: 1 }],
            findOne: [AgentGraphEntity, graphRow("shadow", null, DOCUMENT, 4)],
        })
        const service = await build(em)

        await expect(service.saveDraft("ws-1", "agent-1", 3, DOCUMENT)).resolves.toMatchObject({ draftRev: 4 })

        expect(em.update).toHaveBeenCalledWith(
            AgentGraphEntity,
            { agentId: "agent-1", workspaceId: "ws-1", draftRev: 3 },
            { draft: DOCUMENT, draftRev: 4 },
        )
    })

    it("refuses a save when someone saved after the draft was read", async () => {
        const service = await build(mockEntityManager({ update: [AgentGraphEntity, { affected: 0 }] }))

        expect(await codeOf(service.saveDraft("ws-1", "agent-1", 2, DOCUMENT))).toBe(AgentGraphsErrorCode.DraftConflict)
    })

    it("refuses a draft the product cannot read, before it touches the database", async () => {
        const em = mockEntityManager()
        const service = await build(em)

        expect(await codeOf(service.saveDraft("ws-1", "agent-1", 3, UNREADABLE_DOCUMENT))).toBe(
            AgentGraphsErrorCode.DocumentInvalid,
        )
        expect(em.update).not.toHaveBeenCalled()
    })
})

describe("AgentGraphsService.setMode", () => {
    it("sets whether the graph decides or only records", async () => {
        const em = mockEntityManager({
            update: [AgentGraphEntity, { affected: 1 }],
            findOne: [AgentGraphEntity, graphRow("enforced", null)],
        })
        const service = await build(em)

        await expect(service.setMode("ws-1", "agent-1", "enforced")).resolves.toMatchObject({ mode: "enforced" })
        expect(em.update).toHaveBeenCalledWith(
            AgentGraphEntity,
            { agentId: "agent-1", workspaceId: "ws-1" },
            { mode: "enforced" },
        )
    })

    it("refuses an agent with no graph", async () => {
        const service = await build(mockEntityManager({ update: [AgentGraphEntity, { affected: 0 }] }))

        expect(await codeOf(service.setMode("ws-1", "agent-1", "shadow"))).toBe(AgentGraphsErrorCode.GraphNotFound)
    })

    it("refuses when the graph was there at the update but cannot be read after", async () => {
        const service = await build(
            mockEntityManager({ update: [AgentGraphEntity, { affected: 1 }], findOne: [AgentGraphEntity, null] }),
        )

        expect(await codeOf(service.setMode("ws-1", "agent-1", "shadow"))).toBe(AgentGraphsErrorCode.GraphNotFound)
    })
})

describe("AgentGraphsService.publish", () => {
    const input = {
        workspaceId: "ws-1",
        agentId: "agent-1",
        document: DOCUMENT,
        kind: "edit",
        note: "Raised the bound",
        memberId: "member-1",
        contextVersionId: null,
    } as const

    it("freezes the next version, indexes its sources, makes it the one that decides and keeps the draft in step", async () => {
        const em = mockEntityManager({
            findOne: [
                [AgentGraphEntity, graphRow()],
                [AgentGraphVersionEntity, versionRow(2)],
            ],
            save: [AgentGraphVersionEntity, versionRow(3, DOCUMENT, "version-3")],
            insert: [AgentGraphSourceEntity, {}],
            update: [AgentGraphEntity, { affected: 1 }],
        })
        fakeTransaction(em)
        const service = await build(em)

        await expect(service.publish(input)).resolves.toMatchObject({ id: "version-3", version: 3, changeKind: "edit" })

        expect(em.insert).toHaveBeenCalledWith(
            AgentGraphSourceEntity,
            expect.arrayContaining([
                expect.objectContaining({ versionId: "version-3", kind: "rule", ref: "pay_supplier" }),
            ]),
        )
        expect(em.update).toHaveBeenCalledWith(
            AgentGraphEntity,
            { agentId: "agent-1" },
            { activeVersionId: "version-3", draft: DOCUMENT, draftRev: 4 },
        )
    })

    it("indexes nothing for a graph that cites no source", async () => {
        const em = mockEntityManager({
            findOne: [
                [AgentGraphEntity, graphRow()],
                [AgentGraphVersionEntity, null],
            ],
            save: [AgentGraphVersionEntity, versionRow(1)],
            update: [AgentGraphEntity, { affected: 1 }],
        })
        fakeTransaction(em)
        const service = await build(em)

        await service.publish({ ...input, document: { nodes: [], rights: [] } })

        expect(em.insert).not.toHaveBeenCalled()
        expect(em.create).toHaveBeenCalledWith(AgentGraphVersionEntity, expect.objectContaining({ version: 1 }))
    })

    it("refuses a graph that cannot be read and an agent with no graph", async () => {
        const em = mockEntityManager({ findOne: [AgentGraphEntity, null] })
        fakeTransaction(em)
        const service = await build(em)

        expect(await codeOf(service.publish({ ...input, document: UNREADABLE_DOCUMENT }))).toBe(
            AgentGraphsErrorCode.DocumentInvalid,
        )
        expect(await codeOf(service.publish(input))).toBe(AgentGraphsErrorCode.GraphNotFound)
    })
})

describe("AgentGraphsService.ensure", () => {
    it("leaves an agent that has a graph as it is", async () => {
        const em = mockEntityManager({
            findOne: [
                [AgentGraphEntity, graphRow()],
                [AgentGraphVersionEntity, versionRow()],
            ],
        })
        const service = await build(em)

        await expect(service.ensure("ws-1", "agent-1", "inst-1", DOCUMENT)).resolves.toMatchObject({
            agentId: "agent-1",
        })
        expect(em.transaction).not.toHaveBeenCalled()
    })

    it("writes the draft and version 1 as the seed, in shadow, for an agent with none", async () => {
        const em = mockEntityManager({
            findOne: [
                [AgentGraphEntity, null],
                [AgentGraphEntity, graphRow("shadow", "version-1", DOCUMENT, 1)],
                [AgentGraphVersionEntity, versionRow(1)],
            ],
            countBy: [AgentGraphVersionEntity, 0],
            save: [AgentGraphVersionEntity, versionRow(1, DOCUMENT, "version-1", "seed")],
            insert: [AgentGraphSourceEntity, {}],
            update: [AgentGraphEntity, { affected: 1 }],
        })
        fakeTransaction(em)
        const [fake] = queueQueryBuilders(em, [{ execute: { raw: [] } }])
        const service = await build(em)

        await service.ensure("ws-1", "agent-1", "inst-1", DOCUMENT)

        expect(fake?.callsOf("values")).toEqual([
            [
                {
                    agentId: "agent-1",
                    workspaceId: "ws-1",
                    installationId: "inst-1",
                    draft: DOCUMENT,
                    draftRev: 1,
                    mode: "shadow",
                },
            ],
        ])
        expect(fake?.callsOf("orIgnore")).toEqual([[]])
        expect(em.update).toHaveBeenCalledWith(
            AgentGraphEntity,
            { agentId: "agent-1" },
            { activeVersionId: "version-1" },
        )
    })
})

describe("AgentGraphsService.ensure (continued)", () => {
    it("writes no second seed when another worker wrote it first", async () => {
        const em = mockEntityManager({
            findOne: [
                [AgentGraphEntity, null],
                [AgentGraphEntity, graphRow()],
                [AgentGraphVersionEntity, versionRow()],
            ],
            countBy: [AgentGraphVersionEntity, 1],
        })
        fakeTransaction(em)
        queueQueryBuilders(em, [{ execute: { raw: [] } }])
        const service = await build(em)

        await service.ensure("ws-1", "agent-1", "inst-1", DOCUMENT)

        expect(em.save).not.toHaveBeenCalled()
    })

    it("refuses when the graph still cannot be read after it was written", async () => {
        const em = mockEntityManager({ findOne: [AgentGraphEntity, null], countBy: [AgentGraphVersionEntity, 1] })
        fakeTransaction(em)
        queueQueryBuilders(em, [{ execute: { raw: [] } }])
        const service = await build(em)

        expect(await codeOf(service.ensure("ws-1", "agent-1", "inst-1", DOCUMENT))).toBe(
            AgentGraphsErrorCode.GraphNotFound,
        )
    })
})
