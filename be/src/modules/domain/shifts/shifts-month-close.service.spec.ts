import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { OfficeLog, OutboundMail } from "@modules/domain/module-ops"
import { ACCOUNT_DIRECTORY } from "@modules/domain/workspace-members"
import type { AccountDirectory } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import {
    SELECT_MONTH_CLOSE_WORKSPACES,
    SELECT_MONTH_SHIFTS,
    SELECT_OWNER,
    SELECT_PAYROLL_DONE,
} from "./persistence/shifts-alerts.sql"
import { DEFAULT_SETTINGS } from "./policies/row-mappers.policy"
import type { Setup } from "./shifts.contracts"
import { ShiftsDataService } from "./shifts-data.service"
import { ShiftsMonthCloseService } from "./shifts-month-close.service"
import { ShiftsNotifyService } from "./shifts-notify.service"
import { ShiftsTextService } from "./shifts-text.service"

const SETUP: Setup = {
    positions: [],
    staff: [
        {
            id: "p-1",
            name: "Lan",
            positionIds: [],
            skills: [],
            wage: 30000,
            maxWeek: 48,
            maxDay: 10,
            minRest: 8,
            staffRowId: null,
            telegramChatId: null,
            zaloUserId: null,
            phone: null,
            active: true,
        },
    ],
    blocks: [],
    settings: DEFAULT_SETTINGS,
}

const answer = (em: MockEntityManager, done: boolean, owner: boolean) => {
    em.query.mockImplementation((sql: string) => {
        if (sql === SELECT_MONTH_CLOSE_WORKSPACES)
            return Promise.resolve([{ workspace_id: "ws-1", config: { day: 1, time: "09:00" } }])
        if (sql === SELECT_PAYROLL_DONE) return Promise.resolve([{ done }])
        if (sql === SELECT_MONTH_SHIFTS)
            return Promise.resolve([
                {
                    id: "s-1",
                    schedule_id: "sch",
                    shift_date: "2026-09-03",
                    start_time: "08:00",
                    end_time: "12:00",
                    position_id: "pos",
                    staff_id: "p-1",
                    status: "published",
                    checked_in: true,
                    reminded: false,
                    alerted: false,
                },
            ])
        if (sql === SELECT_OWNER) return Promise.resolve(owner ? [{ user_id: "u-1" }] : [])
        return Promise.resolve([])
    })
}

const build = async (em: MockEntityManager) => {
    const accounts = mock<AccountDirectory>({
        accountOf: () =>
            Promise.resolve({ kind: "ok", value: { email: "owner@shop.test", lastSignInAt: null, displayName: "O" } }),
    })
    const office = mock<OfficeLog>({ logEvidence: () => Promise.resolve() })
    const mail = mock<OutboundMail>({ send: () => Promise.resolve({ status: "sent" }) })
    const data = mock<ShiftsDataService>({ loadSetup: () => Promise.resolve(SETUP) })
    const notify = mock<ShiftsNotifyService>({ toManagers: () => Promise.resolve() })
    const words = mock<ShiftsTextService>({ text: (key: string) => key })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ShiftsMonthCloseService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: ACCOUNT_DIRECTORY, useValue: accounts },
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: OfficeLog, useValue: office },
            { provide: OutboundMail, useValue: mail },
            { provide: ShiftsDataService, useValue: data },
            { provide: ShiftsNotifyService, useValue: notify },
            { provide: ShiftsTextService, useValue: words },
        ],
    }).compile()
    return { service: moduleRef.get(ShiftsMonthCloseService), office, mail, notify }
}

describe("ShiftsMonthCloseService", () => {
    it("closes the month: the CSV to the owner, the summary to Office and the evidence for Accounting", async () => {
        const em = mockEntityManager()
        answer(em, false, true)
        const { service, mail, notify, office } = await build(em)

        await expect(service.close("ws-1", "2026-09")).resolves.toEqual({ done: true, emailed: true, total: 120000 })

        expect(mail.send).toHaveBeenCalledWith(
            expect.objectContaining({
                to: "owner@shop.test",
                purpose: "shifts_month_close",
                audience: "owner",
                attachments: [expect.objectContaining({ filename: "cong-2026-09.csv" })],
            }),
        )
        expect(notify.toManagers).toHaveBeenCalledWith(
            "ws-1",
            expect.stringContaining("shifts.payrollEmailed"),
            "payroll",
        )
        expect(office.logEvidence).toHaveBeenCalledWith("ws-1", expect.objectContaining({ kind: "shifts.payroll" }))
    })

    it("closes a month once", async () => {
        const em = mockEntityManager()
        answer(em, true, true)
        const { service, notify } = await build(em)

        await expect(service.close("ws-1", "2026-09")).resolves.toEqual({ done: false, emailed: false, total: 0 })
        expect(notify.toManagers).not.toHaveBeenCalled()
    })

    it("still posts the summary when there is no owner to mail", async () => {
        const em = mockEntityManager()
        answer(em, false, false)
        const { service, mail, notify } = await build(em)

        await expect(service.close("ws-1", "2026-09")).resolves.toMatchObject({ done: true, emailed: false })
        expect(mail.send).not.toHaveBeenCalled()
        expect(notify.toManagers).toHaveBeenCalledWith("ws-1", "shifts.payrollOffice", "payroll")
    })

    it("on a tick closes the previous month of every workspace past its day and time", async () => {
        const em = mockEntityManager()
        answer(em, false, false)
        const { service } = await build(em)

        await expect(service.tick(new Date("2026-10-01T03:00:00.000Z"))).resolves.toBe(1)
        await expect(service.tick(new Date("2026-10-01T01:00:00.000Z"))).resolves.toBe(0)
    })
})
