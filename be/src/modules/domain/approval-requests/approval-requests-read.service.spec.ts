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
            const asked = Object.assign(new ApprovalRequestEntity(), {
                approvers: [{ memberId: "m1" }, { memberId: "m2" }],
            })
            const em = mockEntityManager({ findOne: [ApprovalRequestEntity, asked] })

            await expect((await build(em)).askedOf("ws-1", "r1")).resolves.toEqual(["m1", "m2"])
            expect(em.findOne).toHaveBeenCalledWith(
                ApprovalRequestEntity,
                expect.objectContaining({ where: { id: "r1", workspaceId: "ws-1", status: "pending" } }),
            )
        })

        it("answers nobody for a request that is settled or not there", async () => {
            const em = mockEntityManager({ findOne: [ApprovalRequestEntity, null] })

            await expect((await build(em)).askedOf("ws-1", "r1")).resolves.toEqual([])
        })
    })
})

describe("ApprovalRequestsReadService card reads", () => {
    describe("cardOf", () => {
        it("answers what the request asks and the group it kept", async () => {
            const request = Object.assign(new ApprovalRequestEntity(), {
                id: "r1",
                action: "refund",
                amount: 200000,
                unit: "vnd",
                requestedByAgentId: "a1",
                approverGroup: { roles: ["owner"], rooms: [], members: [] },
            })
            const em = mockEntityManager({ findOne: [ApprovalRequestEntity, request] })

            await expect((await build(em)).cardOf("ws-1", "r1")).resolves.toEqual({
                id: "r1",
                action: "refund",
                amount: 200000,
                unit: "vnd",
                requestedByAgentId: "a1",
                approverGroup: { roles: ["owner"], rooms: [], members: [] },
            })
            expect(em.findOne).toHaveBeenCalledWith(
                ApprovalRequestEntity,
                expect.objectContaining({ where: { id: "r1", workspaceId: "ws-1" } }),
            )
        })

        it("answers nothing for a request the workspace does not have", async () => {
            const em = mockEntityManager({ findOne: [ApprovalRequestEntity, null] })

            await expect((await build(em)).cardOf("ws-1", "r1")).resolves.toBeNull()
        })
    })

    describe("standingOf", () => {
        it("asks for nothing when no request is given", async () => {
            const em = mockEntityManager()

            await expect((await build(em)).standingOf("ws-1", [])).resolves.toEqual([])
            expect(em.find).not.toHaveBeenCalled()
        })

        it("answers the state, the settler and the asked seats of each request of the workspace", async () => {
            const resolvedAt = new Date("2026-11-06T10:00:00.000Z")
            const em = mockEntityManager({
                find: [
                    ApprovalRequestEntity,
                    [
                        Object.assign(new ApprovalRequestEntity(), {
                            id: "r1",
                            status: "approved",
                            resolvedAt,
                            resolvedBy: "m1",
                            approvers: [{ memberId: "m1" }, { memberId: "m2" }],
                        }),
                    ],
                ],
            })

            await expect((await build(em)).standingOf("ws-1", ["r1"])).resolves.toEqual([
                { id: "r1", status: "approved", resolvedAt, resolvedBy: "m1", askedSeatIds: ["m1", "m2"] },
            ])
            expect(em.find).toHaveBeenCalledWith(ApprovalRequestEntity, {
                select: { id: true, status: true, resolvedAt: true, resolvedBy: true, approvers: true },
                where: { id: In(["r1"]), workspaceId: "ws-1" },
                take: 1,
            })
        })
    })
})
