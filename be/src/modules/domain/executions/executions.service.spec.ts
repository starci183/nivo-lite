import { FakeClock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ExecutionsErrorCode } from "./errors/executions.error"
import type { NewExecution } from "./executions.contracts"
import { ExecutionsService } from "./executions.service"
import {
    FIND_EXECUTION,
    FIND_EXECUTION_RECORD,
    INSERT_EXECUTION,
    LIST_EXECUTIONS,
    SETTLE_EXECUTION,
} from "./persistence/executions.sql"

const card: NewExecution = {
    workspaceId: "ws-1",
    responsibilityId: "resp-1",
    agentId: null,
    draft: "Hello",
    workItemId: "item-1",
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

describe("ExecutionsService", () => {
    it("creates the approval card and answers its id", async () => {
        const em = mockEntityManager({ query: [INSERT_EXECUTION, [{ id: "exec-1" }]] })

        expect(await (await build(em)).open(card)).toBe("exec-1")
        expect(em.query).toHaveBeenCalledWith(INSERT_EXECUTION, ["ws-1", "resp-1", null, "Hello", "item-1"])
    })

    it("is a typed error when the insert answers no row", async () => {
        const service = await build(mockEntityManager({ query: [INSERT_EXECUTION, []] }))

        await expect(service.open(card)).rejects.toThrow(ExecutionsErrorCode.NotCreated)
    })

    it("finds the card of the workspace", async () => {
        const row = { id: "exec-1", status: "pending_approval", work_item_id: "item-1", draft: "Hello" }
        const em = mockEntityManager({ query: [FIND_EXECUTION, [row]] })

        expect(await (await build(em)).find("ws-1", "exec-1")).toEqual(row)
        expect(em.query).toHaveBeenCalledWith(FIND_EXECUTION, ["ws-1", "exec-1"])
    })

    it("answers null when the workspace has no such card", async () => {
        expect(await (await build(mockEntityManager({ query: [FIND_EXECUTION, []] }))).find("ws-1", "x")).toBeNull()
    })

    it("finds the complete card using the default manager", async () => {
        const row = {
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
        const em = mockEntityManager({ query: [FIND_EXECUTION_RECORD, [row]] })

        expect(await (await build(em)).findRecord("ws-1", "exec-1")).toEqual(row)
        expect(em.query).toHaveBeenCalledWith(FIND_EXECUTION_RECORD, ["ws-1", "exec-1"])
    })

    it("reads a missing complete card through the caller's transaction", async () => {
        const em = mockEntityManager()
        const manager = mockEntityManager({ query: [FIND_EXECUTION_RECORD, []] })

        expect(await (await build(em)).findRecord("ws-1", "missing", manager)).toBeNull()
        expect(manager.query).toHaveBeenCalledWith(FIND_EXECUTION_RECORD, ["ws-1", "missing"])
        expect(em.query).not.toHaveBeenCalled()
    })
})

describe("ExecutionsService", () => {
    it.each([
        [{ limit: 25 }, ["ws-1", null, false, 25]],
        [
            { responsibilityIds: ["resp-1", "resp-2"], pendingLegacy: true, limit: 10 },
            ["ws-1", ["resp-1", "resp-2"], true, 10],
        ],
        [{ responsibilityIds: [], pendingLegacy: false, limit: 0 }, ["ws-1", [], false, 0]],
    ] as const)("lists approval cards with the requested filters: %j", async (filter, parameters) => {
        const rows = [{ id: "exec-1" }]
        const em = mockEntityManager({ query: [LIST_EXECUTIONS, rows] })

        expect(await (await build(em)).list("ws-1", filter)).toEqual(rows)
        expect(em.query).toHaveBeenCalledWith(LIST_EXECUTIONS, parameters)
    })

    it("settles a waiting card at the clock time", async () => {
        const row = { id: "exec-1", status: "approved", work_item_id: "item-1", draft: "Edited" }
        const em = mockEntityManager({ query: [SETTLE_EXECUTION, [row]] })
        const settlement = {
            workspaceId: "ws-1",
            executionId: "exec-1",
            decision: "approved" as const,
            decidedBy: "An",
            editedDraft: "Edited",
        }

        expect(await (await build(em)).settle(settlement)).toEqual(row)
        expect(em.query).toHaveBeenCalledWith(SETTLE_EXECUTION, [
            "ws-1",
            "exec-1",
            "approved",
            "An",
            "Edited",
            "2026-10-12T10:00:00.000Z",
        ])
    })

    it("answers null when the card was decided first", async () => {
        const service = await build(mockEntityManager({ query: [SETTLE_EXECUTION, []] }))

        expect(
            await service.settle({
                workspaceId: "ws-1",
                executionId: "exec-1",
                decision: "rejected",
                decidedBy: "An",
                editedDraft: null,
            }),
        ).toBeNull()
    })
})

describe("ExecutionsService", () => {
    it("settles through the supplied transaction manager", async () => {
        const em = mockEntityManager()
        const row = { id: "exec-1", status: "rejected", work_item_id: null, draft: "Hello" }
        const manager = mockEntityManager({ query: [SETTLE_EXECUTION, [row]] })
        const service = await build(em)

        expect(
            await service.settle(
                {
                    workspaceId: "ws-1",
                    executionId: "exec-1",
                    decision: "rejected",
                    decidedBy: "An",
                    editedDraft: null,
                },
                manager,
            ),
        ).toEqual(row)
        expect(manager.query).toHaveBeenCalledWith(SETTLE_EXECUTION, [
            "ws-1",
            "exec-1",
            "rejected",
            "An",
            null,
            "2026-10-12T10:00:00.000Z",
        ])
        expect(em.query).not.toHaveBeenCalled()
    })
})
