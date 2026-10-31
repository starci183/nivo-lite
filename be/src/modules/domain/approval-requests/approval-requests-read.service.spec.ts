import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In, Not } from "typeorm"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ApprovalRequestsReadService } from "./approval-requests-read.service"
import { ApprovalRequestEntity } from "./persistence/entities"

const requestOf = (
    id: string,
    status: ApprovalRequestEntity["status"],
    resolvedBy: string | null,
): ApprovalRequestEntity => Object.assign(new ApprovalRequestEntity(), { id, status, resolvedBy })

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
                        requestOf("r1", "approved", "m1"),
                        requestOf("r2", "expired", null),
                        requestOf("r3", "pending", null),
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

    describe("askedOf", () => {
        it("answers the seats a pending request asked", async () => {
            const asked = Object.assign(new ApprovalRequestEntity(), { approvers: [{ memberId: "m1" }, { memberId: "m2" }] })
            const em = mockEntityManager({ findOne: [ApprovalRequestEntity, asked] })

            await expect((await build(em)).askedOf("ws-1", "r1")).resolves.toEqual(["m1", "m2"])
            expect(em.findOne).toHaveBeenCalledWith(ApprovalRequestEntity, expect.objectContaining({ where: { id: "r1", workspaceId: "ws-1", status: "pending" } }))
        })

        it("answers nobody for a request that is settled or not there", async () => {
            const em = mockEntityManager({ findOne: [ApprovalRequestEntity, null] })

            await expect((await build(em)).askedOf("ws-1", "r1")).resolves.toEqual([])
        })
    })
})
