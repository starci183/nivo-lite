import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { entityOf } from "@tests/fixtures/builders/entity.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { ApprovalRequestsHistoryReadService } from "./approval-requests-history-read.service"
import { ApprovalRequestEntity } from "./persistence/entities"

const AT = new Date("2026-10-12T03:00:00.000Z")
const requestOf = entityOf(ApprovalRequestEntity, {
    id: "r-1",
    department: "sales",
    action: "refund",
    status: "approved",
    resolvedBy: "m-1",
    chainStepId: "c-1",
    resolvedAt: AT,
    createdAt: new Date("2026-10-11T03:00:00.000Z"),
})

const build = async (getMany: ReadonlyArray<unknown>) => {
    const em = mockEntityManager()
    const [fake] = queueQueryBuilders(em, [{ getMany }])
    const moduleRef = await Test.createTestingModule({
        providers: [ApprovalRequestsHistoryReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { service: moduleRef.get(ApprovalRequestsHistoryReadService), fake }
}

describe("ApprovalRequestsHistoryReadService", () => {
    it("pages the ended requests newest first, narrowed by module and ending", async () => {
        const { service, fake } = await build([
            requestOf(),
            requestOf({ id: "r-2", resolvedAt: null, status: "expired" }),
        ])

        await expect(
            service.resolvedPage("ws-1", { department: "sales", status: "approved", skip: 5, limit: 10 }),
        ).resolves.toEqual([
            {
                id: "r-1",
                department: "sales",
                action: "refund",
                status: "approved",
                resolvedBy: "m-1",
                chainStepId: "c-1",
                at: AT,
            },
            {
                id: "r-2",
                department: "sales",
                action: "refund",
                status: "expired",
                resolvedBy: "m-1",
                chainStepId: "c-1",
                at: new Date("2026-10-11T03:00:00.000Z"),
            },
        ])
        expect(fake?.callsOf("andWhere").map(([sql]) => sql)).toEqual([
            "r.department = :department",
            "r.status = :status",
        ])
        expect(fake?.callsOf("offset")).toEqual([[5]])
        expect(fake?.callsOf("limit")).toEqual([[10]])
    })

    it("does not narrow without filters and leaves out a pending row", async () => {
        const { service, fake } = await build([requestOf({ status: "pending" })])

        await expect(
            service.resolvedPage("ws-1", { department: null, status: null, skip: 0, limit: 10 }),
        ).resolves.toEqual([])
        expect(fake?.callsOf("andWhere")).toEqual([])
    })
})
