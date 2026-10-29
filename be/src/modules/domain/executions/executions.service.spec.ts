import { FakeClock, builder, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { In } from "typeorm"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { fakeQueryBuilder, queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { ExecutionsErrorCode } from "./errors/executions.error"
import type { NewExecution } from "./executions.contracts"
import { ExecutionsService } from "./executions.service"
import { ExecutionEntity } from "./persistence/entities"

const card: NewExecution = {
    workspaceId: "ws-1",
    responsibilityId: "resp-1",
    agentId: null,
    draft: "Hello",
    workItemId: "item-1",
}

const entityOf = builder<ExecutionEntity>({
    id: "exec-1",
    workspaceId: "ws-1",
    responsibilityId: "resp-1",
    agentId: null,
    kind: "message",
    draft: "Hello",
    status: "pending_approval",
    decidedBy: null,
    decidedAt: null,
    createdAt: new Date("2026-10-12T09:00:00.000Z"),
    workItemId: "item-1",
})

const recordOf = {
    id: "exec-1",
    workspace_id: "ws-1",
    responsibility_id: "resp-1",
    agent_id: null,
    status: "pending_approval",
    kind: "message",
    work_item_id: "item-1",
    draft: "Hello",
    decided_by: null,
    decided_at: null,
    created_at: "2026-10-12T09:00:00.000Z",
}

const settlement = {
    workspaceId: "ws-1",
    executionId: "exec-1",
    decision: "approved" as const,
    decidedBy: "An",
    editedDraft: "Edited",
}

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            ExecutionsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock("2026-10-12T10:00:00.000Z") },
        ],
    }).compile()
    return moduleRef.get(ExecutionsService)
}

/** A manager whose update query builder answers `raw` and records its chain. */
const settlingManager = (raw: ReadonlyArray<unknown>) => {
    const fake = fakeQueryBuilder({ execute: { raw } })
    const manager = mockEntityManager()
    manager.createQueryBuilder.mockReturnValue(fake.builder as never)
    return { fake, manager }
}

describe("ExecutionsService", () => {
    it("creates the approval card and answers its id", async () => {
        const em = mockEntityManager({ insert: [ExecutionEntity, { identifiers: [{ id: "exec-1" }] }] })

        expect(await (await build(em)).open(card)).toBe("exec-1")
        expect(em.insert).toHaveBeenCalledWith(ExecutionEntity, {
            workspaceId: "ws-1",
            responsibilityId: "resp-1",
            agentId: null,
            draft: "Hello",
            workItemId: "item-1",
        })
    })

    it("is a typed error when the insert answers no row", async () => {
        const service = await build(mockEntityManager({ insert: [ExecutionEntity, { identifiers: [] }] }))

        await expect(service.open(card)).rejects.toThrow(ExecutionsErrorCode.NotCreated)
    })

    it("finds the card of the workspace", async () => {
        const em = mockEntityManager({ findOne: [ExecutionEntity, entityOf()] })

        expect(await (await build(em)).find("ws-1", "exec-1")).toEqual({
            id: "exec-1",
            status: "pending_approval",
            work_item_id: "item-1",
            draft: "Hello",
        })
        expect(em.findOne).toHaveBeenCalledWith(ExecutionEntity, {
            select: { id: true, status: true, workItemId: true, draft: true },
            where: { workspaceId: "ws-1", id: "exec-1" },
        })
    })

    it("answers null when the workspace has no such card", async () => {
        expect(
            await (await build(mockEntityManager({ findOne: [ExecutionEntity, null] }))).find("ws-1", "x"),
        ).toBeNull()
    })

    it("finds the complete card using the default manager, the times as ISO text", async () => {
        const em = mockEntityManager()
        const [query] = queueQueryBuilders(em, [{ getRawOne: recordOf }])

        expect(await (await build(em)).findRecord("ws-1", "exec-1")).toEqual(recordOf)
        expect(query?.callsOf("addSelect")).toContainEqual(["to_json(x.created_at) #>> '{}'", "created_at"])
        expect(query?.callsOf("addSelect")).toContainEqual(["to_json(x.decided_at) #>> '{}'", "decided_at"])
        expect(query?.callsOf("andWhere")).toEqual([["x.id = :executionId", { executionId: "exec-1" }]])
        expect(query?.callsOf("limit")).toEqual([[1]])
    })

    it("answers the decision of a decided card", async () => {
        const decided = { ...recordOf, status: "approved", decided_by: "An", decided_at: "2026-10-12T09:30:00.000Z" }
        const em = mockEntityManager()
        queueQueryBuilders(em, [{ getRawOne: decided }])

        expect(await (await build(em)).findRecord("ws-1", "exec-1")).toMatchObject({
            status: "approved",
            decided_by: "An",
            decided_at: "2026-10-12T09:30:00.000Z",
        })
    })

    it("reads a missing complete card through the caller transaction", async () => {
        const em = mockEntityManager()
        const manager = mockEntityManager()
        queueQueryBuilders(manager, [{ getRawOne: undefined }])

        expect(await (await build(em)).findRecord("ws-1", "missing", manager)).toBeNull()
        expect(manager.createQueryBuilder).toHaveBeenCalledTimes(1)
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})

describe("ExecutionsService lists", () => {
    it.each([
        [{ limit: 25 }, [], 25],
        [
            { responsibilityIds: ["resp-1", "resp-2"], pendingLegacy: true, limit: 10 },
            [
                ["x.responsibilityId = ANY(:responsibilityIds)", { responsibilityIds: ["resp-1", "resp-2"] }],
                ["x.status = 'pending_approval' AND x.workItemId IS NULL"],
            ],
            10,
        ],
        [
            { responsibilityIds: [], pendingLegacy: false, limit: 0 },
            [["x.responsibilityId = ANY(:responsibilityIds)", { responsibilityIds: [] }]],
            0,
        ],
    ] as const)("approval cards with the requested filters: %j", async (filter, conditions, limit) => {
        const em = mockEntityManager()
        const [query] = queueQueryBuilders(em, [{ getRawMany: [recordOf] }])

        expect(await (await build(em)).list("ws-1", filter)).toEqual([recordOf])
        expect(query?.callsOf("where")).toEqual([["x.workspaceId = :workspaceId", { workspaceId: "ws-1" }]])
        expect(query?.callsOf("andWhere")).toEqual(conditions)
        expect(query?.callsOf("orderBy")).toEqual([["x.createdAt", "ASC"]])
        expect(query?.callsOf("addOrderBy")).toEqual([["x.id", "ASC"]])
        expect(query?.callsOf("limit")).toEqual([[limit]])
    })
})

describe("ExecutionsService approvals", () => {
    it("reads the cards waiting for a decision, newest first, bounded", async () => {
        const em = mockEntityManager()
        const [query] = queueQueryBuilders(em, [{ getRawMany: [recordOf] }])

        expect(await (await build(em)).pendingApprovals("ws-1", 100)).toEqual([recordOf])
        expect(query?.callsOf("andWhere")).toEqual([["x.status = 'pending_approval'"]])
        expect(query?.callsOf("orderBy")).toEqual([["x.createdAt", "DESC"]])
        expect(query?.callsOf("addOrderBy")).toEqual([["x.id", "DESC"]])
        expect(query?.callsOf("limit")).toEqual([[100]])
    })

    it("reads the decided cards, newest decision first with undated decisions last, bounded", async () => {
        const em = mockEntityManager()
        const [query] = queueQueryBuilders(em, [{ getRawMany: [recordOf] }])

        expect(await (await build(em)).decidedApprovals("ws-1", 8)).toEqual([recordOf])
        expect(query?.callsOf("andWhere")).toEqual([["x.status IN ('approved', 'rejected')"]])
        expect(query?.callsOf("orderBy")).toEqual([["x.decidedAt", "DESC", "NULLS LAST"]])
        expect(query?.callsOf("limit")).toEqual([[8]])
    })

    it("asks for no status when no card is given", async () => {
        const em = mockEntityManager()

        expect(await (await build(em)).statusesOf("ws-1", [])).toEqual([])
        expect(em.find).not.toHaveBeenCalled()
    })

    it("reads the status of the given cards of the workspace once each", async () => {
        const em = mockEntityManager({ find: [ExecutionEntity, [entityOf()]] })

        expect(await (await build(em)).statusesOf("ws-1", ["exec-1", "exec-1"])).toEqual([
            { id: "exec-1", status: "pending_approval" },
        ])
        expect(em.find).toHaveBeenCalledWith(ExecutionEntity, {
            select: { id: true, status: true },
            where: { workspaceId: "ws-1", id: In(["exec-1"]) },
        })
    })
})

describe("ExecutionsService settles", () => {
    it("a waiting card at the clock time", async () => {
        const row = { id: "exec-1", status: "approved", work_item_id: "item-1", draft: "Edited" }
        const { fake, manager } = settlingManager([row])

        expect(await (await build(manager)).settle(settlement)).toEqual(row)
        expect(fake.callsOf("update")).toEqual([[]])
        expect(fake.callsOf("set")).toEqual([
            [
                {
                    status: "approved",
                    decidedBy: "An",
                    decidedAt: new Date("2026-10-12T10:00:00.000Z"),
                    draft: "Edited",
                },
            ],
        ])
        expect(fake.callsOf("where")).toEqual([
            [
                "workspace_id = :workspaceId AND id = :executionId AND status = 'pending_approval'",
                { workspaceId: "ws-1", executionId: "exec-1" },
            ],
        ])
        expect(fake.callsOf("returning")).toEqual([["id, status, work_item_id, draft"]])
    })

    it("keeping the draft when nobody edited it", async () => {
        const { fake, manager } = settlingManager([])

        await (await build(manager)).settle({ ...settlement, decision: "rejected", editedDraft: null })

        expect(fake.callsOf("set")).toEqual([
            [{ status: "rejected", decidedBy: "An", decidedAt: new Date("2026-10-12T10:00:00.000Z") }],
        ])
    })

    it("answering null when the card was decided first", async () => {
        const { manager } = settlingManager([])

        expect(await (await build(manager)).settle({ ...settlement, editedDraft: null })).toBeNull()
    })

    it("through the supplied transaction manager", async () => {
        const em = mockEntityManager()
        const row = { id: "exec-1", status: "rejected", work_item_id: null, draft: "Hello" }
        const { manager } = settlingManager([row])

        expect(
            await (await build(em)).settle({ ...settlement, decision: "rejected", editedDraft: null }, manager),
        ).toEqual(row)
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})
