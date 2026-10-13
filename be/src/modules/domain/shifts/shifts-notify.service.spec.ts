import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { OfficeLog } from "@modules/domain/module-ops"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { RECORD_NOTIFICATION } from "./persistence/shifts.sql"
import { ShiftsNotifyService } from "./shifts-notify.service"

const build = async (entityManager: MockEntityManager) => {
    const office = mock<OfficeLog>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ShiftsNotifyService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: OfficeLog, useValue: office },
        ],
    }).compile()
    return { service: moduleRef.get(ShiftsNotifyService), office }
}

describe("ShiftsNotifyService", () => {
    it("records a sent Office notification with both schedule and shift references", async () => {
        const em = mockEntityManager({ query: [RECORD_NOTIFICATION, []] })
        const { service, office } = await build(em)

        await expect(
            service.toStaff("ws-1", {
                staffId: "staff-1",
                kind: "publish",
                body: "The weekly schedule is ready",
                scheduleId: "schedule-1",
                shiftId: "shift-1",
            }),
        ).resolves.toBeUndefined()

        expect(em.query).toHaveBeenCalledTimes(1)
        expect(em.query).toHaveBeenCalledWith(RECORD_NOTIFICATION, [
            "ws-1",
            "staff-1",
            "schedule-1",
            "shift-1",
            "publish",
            "office",
            "sent",
            "The weekly schedule is ready",
        ])
        expect(office.postOffice).not.toHaveBeenCalled()
    })

    it("records null references when a staff notice has no schedule or shift", async () => {
        const em = mockEntityManager({ query: [RECORD_NOTIFICATION, []] })
        const { service } = await build(em)

        await service.toStaff("ws-2", { staffId: "staff-2", kind: "leave", body: "Leave approved" })

        expect(em.query).toHaveBeenCalledTimes(1)
        expect(em.query).toHaveBeenCalledWith(RECORD_NOTIFICATION, [
            "ws-2",
            "staff-2",
            null,
            null,
            "leave",
            "office",
            "sent",
            "Leave approved",
        ])
    })

    it("posts a manager message in the workspace Office", async () => {
        const em = mockEntityManager()
        const { service, office } = await build(em)

        await expect(service.toManagers("ws-1", "One shift is still open")).resolves.toBeUndefined()

        expect(office.postOffice).toHaveBeenCalledTimes(1)
        expect(office.postOffice).toHaveBeenCalledWith("ws-1", "One shift is still open")
        expect(em.query).not.toHaveBeenCalled()
    })
})
