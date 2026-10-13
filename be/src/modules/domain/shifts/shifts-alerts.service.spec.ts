import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { ActionPerformerRegistry, ApprovalGate, OfficeLog } from "@modules/domain/module-ops"
import type { PerformContext } from "@modules/domain/module-ops"
import { WorkspacesService } from "@modules/domain/workspaces"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import {
    SELECT_ALERT_SHIFT,
    SELECT_ALERT_SHIFTS,
    SELECT_DAY_MATES,
    SELECT_REMINDER_ON,
    SELECT_REMINDER_WORKSPACES,
} from "./persistence/shifts-alerts.sql"
import type { AlertShiftRow } from "./persistence/shifts-alerts.rows"
import { DEFAULT_SETTINGS } from "./policies/row-mappers.policy"
import { ShiftsAlertsService } from "./shifts-alerts.service"
import type { Setup } from "./shifts.contracts"
import { ShiftsDataService } from "./shifts-data.service"
import { ShiftsMonthCloseService } from "./shifts-month-close.service"
import { ShiftsNotifyService } from "./shifts-notify.service"
import { ShiftsTextService } from "./shifts-text.service"

/** 07:00 in Vietnam on 2026-10-14: one hour before the 08:00 shift. */
const NOW = "2026-10-14T00:00:00.000Z"

const row = (flags: Partial<AlertShiftRow> = {}): AlertShiftRow => ({
    id: "s-1",
    schedule_id: "sch-1",
    shift_date: "2026-10-14",
    start_time: "08:00:00",
    end_time: "12:00:00",
    position_id: "pos-1",
    staff_id: "p-1",
    status: "published",
    checked_in: false,
    reminded: false,
    alerted: false,
    ...flags,
})

const SETUP: Setup = {
    positions: [{ id: "pos-1", name: "Barista", color: "#000" }],
    staff: [
        {
            id: "p-1",
            name: "Lan",
            positionIds: ["pos-1"],
            skills: [],
            wage: 0,
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

const answer = (em: MockEntityManager, rows: ReadonlyArray<AlertShiftRow>, enabled = true) => {
    em.query.mockImplementation((sql: string) => {
        if (sql === SELECT_REMINDER_WORKSPACES)
            return Promise.resolve([{ workspace_id: "ws-1", config: null, remind_minutes: 60, noshow_minutes: 10 }])
        if (sql === SELECT_ALERT_SHIFTS || sql === SELECT_ALERT_SHIFT) return Promise.resolve(rows)
        if (sql === SELECT_REMINDER_ON) return Promise.resolve([{ enabled }])
        if (sql === SELECT_DAY_MATES) return Promise.resolve([{ name: "Minh" }])
        return Promise.resolve([])
    })
}

const build = async (em: MockEntityManager, now = NOW) => {
    const outbox = recordingQueueOutbox()
    const registry = mock<ActionPerformerRegistry>()
    const gate = mock<ApprovalGate>({ request: () => Promise.resolve({ status: "done", workItemId: "wi-1" }) })
    const office = mock<OfficeLog>({ logEvidence: () => Promise.resolve() })
    const workspaces = mock<WorkspacesService>({ nameOf: () => Promise.resolve("Spa") })
    const data = mock<ShiftsDataService>({ loadSetup: () => Promise.resolve(SETUP) })
    const monthClose = mock<ShiftsMonthCloseService>({ tick: () => Promise.resolve(0) })
    const notify = mock<ShiftsNotifyService>({
        toStaff: () => Promise.resolve({ office: true, telegram: true, zalo: null }),
        toManagers: () => Promise.resolve(),
    })
    const words = mock<ShiftsTextService>({
        text: (key: string, params?: Record<string, string | number>) =>
            `${key}${params ? JSON.stringify(params) : ""}`,
        line: () => "line",
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ShiftsAlertsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: QUEUE_OUTBOX, useValue: outbox },
            { provide: LOGGER, useValue: mock<Logger>() },
            { provide: CLOCK, useValue: new FakeClock(now) },
            { provide: ActionPerformerRegistry, useValue: registry },
            { provide: ApprovalGate, useValue: gate },
            { provide: OfficeLog, useValue: office },
            { provide: WorkspacesService, useValue: workspaces },
            { provide: ShiftsDataService, useValue: data },
            { provide: ShiftsMonthCloseService, useValue: monthClose },
            { provide: ShiftsNotifyService, useValue: notify },
            { provide: ShiftsTextService, useValue: words },
        ],
    }).compile()
    return { service: moduleRef.get(ShiftsAlertsService), outbox, registry, gate, office, monthClose, notify }
}

const context = (fields: PerformContext["fields"]): PerformContext => ({
    workspaceId: "ws-1",
    workItemId: "wi-1",
    actor: "NIVO",
    draft: null,
    fields,
})

describe("ShiftsAlertsService", () => {
    it("registers the remind_shift performer", async () => {
        const { service, registry } = await build(mockEntityManager())

        service.onModuleInit()

        expect(registry.add).toHaveBeenCalledWith(expect.objectContaining({ action: "remind_shift" }))
    })

    describe("runJob", () => {
        it("on a tick queues the due reminder once per shift and person, then closes the month where due", async () => {
            const em = fakeTransaction(mockEntityManager()).em
            answer(em, [row()])
            const { service, outbox, monthClose } = await build(em)

            await service.runJob({ kind: "tick" })

            expect(outbox.jobsOf("shifts_alerts")).toEqual([
                { queue: "shifts_alerts", payload: { kind: "remind", workspaceId: "ws-1", shiftId: "s-1" } },
            ])
            expect(outbox.allInTransaction).toBe(true)
            expect(monthClose.tick).toHaveBeenCalledWith(new Date(NOW))
        })

        it("queues a no-show check after the delay", async () => {
            const em = fakeTransaction(mockEntityManager()).em
            answer(em, [row({ reminded: true })])
            const { service, outbox } = await build(em, "2026-10-14T01:15:00.000Z")

            await service.runJob({ kind: "tick" })

            expect(outbox.jobsOf("shifts_alerts")).toEqual([
                { queue: "shifts_alerts", payload: { kind: "noshow", workspaceId: "ws-1", shiftId: "s-1" } },
            ])
        })

        it("drops a foreign payload", async () => {
            const em = mockEntityManager()
            const { service, gate } = await build(em)

            await service.runJob({ commandId: "c-1" })

            expect(em.query).not.toHaveBeenCalled()
            expect(gate.request).not.toHaveBeenCalled()
        })

        it("asks the gate to remind the person of a queued shift", async () => {
            const em = mockEntityManager()
            answer(em, [row()])
            const { service, gate } = await build(em)

            await service.runJob({ kind: "remind", workspaceId: "ws-1", shiftId: "s-1" })

            expect(gate.request).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: "remind_shift",
                    dedupeKey: "remind_shift:s-1:p-1",
                    fields: { shift_id: "s-1", staff_id: "p-1" },
                }),
            )
        })

        it("tells the managers when nobody checked in", async () => {
            const em = mockEntityManager()
            answer(em, [row({ reminded: true })])
            const { service, notify, office } = await build(em, "2026-10-14T01:15:00.000Z")

            await service.runJob({ kind: "noshow", workspaceId: "ws-1", shiftId: "s-1" })

            expect(notify.toManagers).toHaveBeenCalledWith(
                "ws-1",
                expect.stringContaining("shifts.noShowOffice"),
                "no_show",
                {
                    shiftId: "s-1",
                },
            )
            expect(office.logEvidence).toHaveBeenCalledWith("ws-1", expect.objectContaining({ kind: "shifts.no_show" }))
        })
    })

    describe("remind", () => {
        it("skips when the automation is off, the shift is gone or the person was reminded", async () => {
            const off = mockEntityManager()
            answer(off, [row()], false)
            await expect((await build(off)).service.remind("ws-1", "s-1")).resolves.toBe("skipped: automation off")

            const gone = mockEntityManager()
            answer(gone, [])
            await expect((await build(gone)).service.remind("ws-1", "s-1")).resolves.toBe("skipped: shift not active")

            const done = mockEntityManager()
            answer(done, [row({ reminded: true })])
            await expect((await build(done)).service.remind("ws-1", "s-1")).resolves.toBe("skipped: already reminded")
        })
    })

    describe("noShow", () => {
        it.each([
            ["a checked-in person", row({ checked_in: true }), "2026-10-14T01:15:00.000Z", "checked in"],
            ["an alert already sent", row({ alerted: true }), "2026-10-14T01:15:00.000Z", "already alerted"],
            ["a shift that is over", row(), "2026-10-14T05:00:00.000Z", "skipped: shift is over"],
        ])("sends nothing for %s", async (_name, shift, now, verdict) => {
            const em = mockEntityManager()
            answer(em, [shift])
            const { service, notify } = await build(em, now)

            await expect(service.noShow("ws-1", "s-1", new Date(now))).resolves.toBe(verdict)
            expect(notify.toManagers).not.toHaveBeenCalled()
        })
    })

    describe("performRemind", () => {
        it("reminds the person with the others on duty and says where it went", async () => {
            const em = mockEntityManager()
            answer(em, [row()])
            const { service, notify } = await build(em)

            const result = await service.performRemind(context({ shift_id: "s-1", staff_id: "p-1" }))

            expect(notify.toStaff).toHaveBeenCalledWith(
                "ws-1",
                expect.objectContaining({ staffId: "p-1", kind: "reminder", shiftId: "s-1", workItemId: "wi-1" }),
            )
            expect(result).toEqual({
                summary: expect.stringContaining("shifts.remindDoneTelegram"),
                evidence: "captured",
            })
        })

        it("reminds nobody for a shift that is no longer active", async () => {
            const em = mockEntityManager()
            answer(em, [])
            const { service, notify } = await build(em)

            await expect(service.performRemind(context({ shift_id: "s-1" }))).resolves.toEqual({
                summary: "shifts.remindInactive",
                evidence: "pending",
            })
            expect(notify.toStaff).not.toHaveBeenCalled()
        })
    })
})
