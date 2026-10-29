import { Test } from "@nestjs/testing"
import { mockEntityManager, queueQueryBuilders } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ShiftsLeaveReadService } from "./shifts-leave-read.service"

const WINDOW = { workspaceId: "ws-1", from: "2026-10-12", to: "2026-10-13" }

const build = async () => {
    const em = mockEntityManager()
    const moduleRef = await Test.createTestingModule({
        providers: [ShiftsLeaveReadService, { provide: PRIMARY_ENTITY_MANAGER, useValue: em }],
    }).compile()
    return { service: moduleRef.get(ShiftsLeaveReadService), em }
}

describe("ShiftsLeaveReadService", () => {
    it("answers the approved leave of the given staff that touches the window", async () => {
        const { service, em } = await build()
        const [read] = queueQueryBuilders(em, [
            {
                getRawMany: [{ staff_id: "staff-1", from_date: "2026-10-12", to_date: "2026-10-14" }, { staff_id: 7 }],
            },
        ])

        await expect(service.approvedLeave({ ...WINDOW, staffIds: ["staff-1"] })).resolves.toEqual([
            { staffId: "staff-1", fromDate: "2026-10-12", toDate: "2026-10-14" },
        ])

        expect(read?.callsOf("where")).toEqual([["l.workspaceId = :workspaceId", { workspaceId: "ws-1" }]])
        expect(read?.callsOf("andWhere")[0]).toEqual(["p.staff_id IN (:...staffIds)", { staffIds: ["staff-1"] }])
        expect(read?.callsOf("limit")).toEqual([[500]])
    })

    it("reads nothing for no staff", async () => {
        const { service, em } = await build()

        await expect(service.approvedLeave({ ...WINDOW, staffIds: [] })).resolves.toEqual([])

        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})
