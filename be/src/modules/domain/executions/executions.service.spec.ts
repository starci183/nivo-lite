import { FakeClock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ExecutionsErrorCode } from "./errors/executions.error"
import type { NewExecution } from "./executions.contracts"
import { ExecutionsService } from "./executions.service"
import { FIND_EXECUTION, INSERT_EXECUTION, SETTLE_EXECUTION } from "./persistence/executions.sql"

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
