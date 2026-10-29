import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In, Not } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ApprovalRequestsReadService } from "./approval-requests-read.service"
import { ApprovalRequestEntity } from "./persistence/entities"

const requestOf = (record: Pick<ApprovalRequestEntity, "id" | "status" | "resolvedBy">): ApprovalRequestEntity =>
    Object.assign(new ApprovalRequestEntity(), record)

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [ApprovalRequestsReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(ApprovalRequestsReadService)
}

describe("ApprovalRequestsReadService", () => {
    describe("settledOf", () => {
        it("asks for nothing when no request is given", async () => {
            const em = mockEntityManager()

            await expect((await build(em)).settledOf([])).resolves.toEqual([])
            expect(em.find).not.toHaveBeenCalled()
        })

        it("answers how the settled requests among the ids ended", async () => {
            const em = mockEntityManager({
                find: [
                    ApprovalRequestEntity,
                    [
                        requestOf({ id: "r1", status: "approved", resolvedBy: "m1" }),
                        requestOf({ id: "r2", status: "expired", resolvedBy: null }),
                        requestOf({ id: "r3", status: "pending", resolvedBy: null }),
                    ],
                ],
            })

            await expect((await build(em)).settledOf(["r1", "r2", "r3"])).resolves.toEqual([
                { id: "r1", status: "approved", resolvedBy: "m1" },
                { id: "r2", status: "expired", resolvedBy: null },
            ])
            expect(em.find).toHaveBeenCalledWith(ApprovalRequestEntity, {
                select: { id: true, status: true, resolvedBy: true },
                where: { id: In(["r1", "r2", "r3"]), status: Not("pending") },
                take: 3,
            })
        })
    })
})
