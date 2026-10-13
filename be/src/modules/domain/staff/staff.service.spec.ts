import { Test } from "@nestjs/testing"
import { builder, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { StaffRow } from "./persistence/staff.rows"
import { LIST_STAFF } from "./persistence/staff.sql"
import { StaffService } from "./staff.service"

const rowOf = builder<StaffRow>({
    id: "staff-1",
    workspace_id: "ws-1",
    name: "Mai",
    role: "cashier",
    email: null,
    active: true,
    created_at: "2026-10-01T00:00:00.000Z",
})

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [StaffService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(StaffService)
}

describe("StaffService", () => {
    describe("list", () => {
        it("lists the staff of the workspace", async () => {
            const row = rowOf({ email: "mai@example.test", active: false })
            const em = mockEntityManager({ query: [LIST_STAFF, [row]] })

            await expect((await build(em)).list("ws-1")).resolves.toEqual([row])
            expect(em.query).toHaveBeenCalledWith(LIST_STAFF, ["ws-1"])
        })
    })
})
