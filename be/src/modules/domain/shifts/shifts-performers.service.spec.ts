import { Test } from "@nestjs/testing"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { ActionPerformerRegistry, OfficeLog } from "@modules/domain/module-ops"
import type { PerformContext } from "@modules/domain/module-ops"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { MessageCatalog } from "@modules/platform/i18n"
import { ShiftsErrorCode } from "./errors/shifts.error"
import { ShiftsCoverService } from "./shifts-cover.service"
import { ShiftsDataService } from "./shifts-data.service"
import { ShiftsNotifyService } from "./shifts-notify.service"
import { ShiftsPerformersService } from "./shifts-performers.service"
import { ShiftsRequestsService } from "./shifts-requests.service"
import { ShiftsTextService } from "./shifts-text.service"
import type { Setup, Shift, ShiftStaff } from "./shifts.contracts"
import type { ShiftsLeaveRow, ShiftsScheduleRow, ShiftsSwapRow } from "./persistence/shifts.rows"
import { PUBLISH_SCHEDULE } from "./persistence/shifts.sql"

const text = (key: string, params: Record<string, string | number> = {}): string => `${key}${JSON.stringify(params)}`

const staffOf = builder<ShiftStaff>({
    id: "staff-1",
    name: "Alice",
    positionIds: ["position-1"],
    skills: [],
    wage: 30000,
    maxWeek: 40,
    maxDay: 8,
    minRest: 12,
    staffRowId: "office-staff-1",
    telegramChatId: null,
    zaloUserId: null,
    phone: null,
    active: true,
})

const setupOf = builder<Setup>({
    positions: [{ id: "position-1", name: "Barista", color: "#123456" }],
    staff: [staffOf(), staffOf({ id: "staff-2", name: "Bob" })],
    blocks: [],
    settings: {
        openingHours: [],
        swapNoticeHours: 24,
        leaveNoticeDays: 3,
        remindMinutes: 30,
        noshowMinutes: 15,
        overtimeHoursWeek: 40,
    },
})

const shiftOf = builder<Shift>({
    id: "shift-1",
    date: "2026-10-12",
    start: "08:00",
    end: "10:00",
    positionId: "position-1",
    staffId: "staff-1",
    status: "published",
})

const scheduleOf = builder<ShiftsScheduleRow>({
    id: "schedule-1",
    week_start: "2026-10-12",
    version: 3,
    status: "draft",
    cost_vnd: 60000,
    summary: {},
    evidence: { solver: "fixed" },
})

const swapOf = builder<ShiftsSwapRow>({
    id: "swap-1",
    kind: "swap",
    shift_id: "shift-1",
    from_staff_id: "staff-1",
    to_staff_id: "staff-2",
    status: "pending",
})

const leaveOf = builder<ShiftsLeaveRow>({
    id: "leave-1",
    staff_id: "staff-1",
    from_date: "2026-10-12",
    to_date: "2026-10-13",
    reason: "Travel",
    status: "pending",
})

const context: PerformContext = {
    workspaceId: "ws-1",
    workItemId: "work-1",
    actor: "Manager",
    draft: null,
    fields: {
        schedule_id: "schedule-1",
        week_start: "2026-10-12",
        swap_id: "swap-1",
        leave_id: "leave-1",
    },
}

const build = async (entityManager: MockEntityManager = mockEntityManager()) => {
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => text(key, params))
    const registry = mock<ActionPerformerRegistry>()
    const office = mock<OfficeLog>()
    const data = mock<ShiftsDataService>()
    data.scheduleRow.mockResolvedValue(scheduleOf())
    data.swapRow.mockResolvedValue(swapOf())
    data.leaveRow.mockResolvedValue(leaveOf())
    data.loadSetup.mockResolvedValue(setupOf())
    data.scheduleShifts.mockResolvedValue([])
    const words = mock<ShiftsTextService>()
    words.text.mockImplementation((key, params) => catalog.get(key, params ?? {}, "vi"))
    words.week.mockImplementation((monday) => `week:${monday}`)
    words.line.mockImplementation((_setup, shift) => `line:${shift.id}`)
    words.range.mockImplementation((from, to) => `range:${from}:${to}`)
    words.findings.mockImplementation((findings) =>
        findings.map((finding) => text(`shifts.finding.${finding.code}`, { ...finding.params })),
    )
    const notify = mock<ShiftsNotifyService>()
    const requests = mock<ShiftsRequestsService>()
    requests.checkSwap.mockResolvedValue({ shift: shiftOf(), setup: setupOf(), findings: [] })
    const cover = mock<ShiftsCoverService>()
    cover.suggestions.mockResolvedValue(["Alice can cover", "Bob can cover"])
    const moduleRef = await Test.createTestingModule({
        providers: [
            ShiftsPerformersService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: ActionPerformerRegistry, useValue: registry },
            { provide: OfficeLog, useValue: office },
            { provide: ShiftsDataService, useValue: data },
            { provide: ShiftsTextService, useValue: words },
            { provide: ShiftsNotifyService, useValue: notify },
            { provide: ShiftsRequestsService, useValue: requests },
            { provide: ShiftsCoverService, useValue: cover },
        ],
    }).compile()
    return { service: moduleRef.get(ShiftsPerformersService), registry, office, data, words, notify, requests, cover }
}

describe("ShiftsPerformersService", () => {
    it("registers and delegates all three perform and reject callbacks", async () => {
        const em = mockEntityManager()
        const { service, registry, data, office } = await build(em)
        data.scheduleRow.mockResolvedValue(scheduleOf({ status: "published" }))
        data.swapRow.mockResolvedValue(swapOf({ status: "approved" }))
        data.leaveRow.mockResolvedValue(leaveOf({ status: "approved" }))

        service.onModuleInit()

        expect(registry.add.mock.calls.map(([performer]) => performer.action)).toEqual([
            "publish_schedule",
            "approve_swap",
            "approve_leave",
        ])
        const [publish, swap, leave] = registry.add.mock.calls.map(([performer]) => performer)
        await expect(publish?.perform(context)).resolves.toEqual({
            summary: text("shifts.publishAlready", { week: "week:2026-10-12" }),
            evidence: "captured",
        })
        await expect(swap?.perform(context)).resolves.toEqual({
            summary: text("shifts.swapAlready"),
            evidence: "captured",
        })
        await expect(leave?.perform(context)).resolves.toEqual({
            summary: text("shifts.leaveAlready"),
            evidence: "captured",
        })
        await publish?.reject?.(context)
        await swap?.reject?.(context)
        await leave?.reject?.(context)

        expect(office.logEvidence.mock.calls).toEqual([
            [
                "ws-1",
                {
                    kind: "shifts.publish_declined",
                    actor: "Manager",
                    summary: text("shifts.publishDeclined", { week: "week:2026-10-12" }),
                    workItemId: "work-1",
                },
            ],
        ])
        expect(em.query).not.toHaveBeenCalled()
        expect(data.scheduleRow.mock.calls).toEqual([["ws-1", "schedule-1"]])
        expect(data.swapRow.mock.calls).toEqual([
            ["ws-1", "swap-1"],
            ["ws-1", "swap-1"],
        ])
        expect(data.leaveRow.mock.calls).toEqual([
            ["ws-1", "leave-1"],
            ["ws-1", "leave-1"],
        ])
    })

    describe("performPublish", () => {
        it("publishes with preserved evidence and sends grouped hours and four open shift lines", async () => {
            const em = mockEntityManager({ query: [PUBLISH_SCHEDULE, []] })
            const { service, data, notify, office, words } = await build(em)
            data.scheduleShifts.mockResolvedValue([
                shiftOf(),
                shiftOf({ id: "shift-2", start: "10:30", end: "13:00" }),
                shiftOf({ id: "shift-3", staffId: "staff-2", end: "11:00" }),
                ...["open-1", "open-2", "open-3", "open-4", "open-5"].map((id) => shiftOf({ id, staffId: null })),
                shiftOf({ id: "draft-1", status: "draft" }),
            ])

            await expect(service.performPublish(context)).resolves.toEqual({
                summary: text("shifts.publishDone", { week: "week:2026-10-12", people: 2 }),
                evidence: "captured",
                detail: "3",
            })

            expect(em.query.mock.calls).toEqual([
                [
                    PUBLISH_SCHEDULE,
                    [
                        "ws-1",
                        "schedule-1",
                        `{"solver":"fixed","publish":{"by":"Manager","workItemId":"work-1"}}`,
                        "work-1",
                    ],
                ],
            ])
            expect(data.loadSetup.mock.calls).toEqual([["ws-1", false]])
            expect(data.scheduleShifts.mock.calls).toEqual([["ws-1", "schedule-1"]])
            expect(notify.toStaff.mock.calls).toEqual([
                [
                    "ws-1",
                    {
                        staffId: "staff-1",
                        kind: "publish",
                        scheduleId: "schedule-1",
                        body: text("shifts.personalSchedule", {
                            week: "week:2026-10-12",
                            count: 2,
                            hours: 4.5,
                            lines: "- line:shift-1\n- line:shift-2",
                        }),
                    },
                ],
                [
                    "ws-1",
                    {
                        staffId: "staff-2",
                        kind: "publish",
                        scheduleId: "schedule-1",
                        body: text("shifts.personalSchedule", {
                            week: "week:2026-10-12",
                            count: 1,
                            hours: 3,
                            lines: "- line:shift-3",
                        }),
                    },
                ],
            ])
            expect(notify.toManagers.mock.calls).toEqual([
                [
                    "ws-1",
                    text("shifts.gapOffice", {
                        count: 5,
                        week: "week:2026-10-12",
                        lines: "line:open-1; line:open-2; line:open-3; line:open-4",
                    }),
                ],
            ])
            expect(words.line.mock.calls.map(([, shift]) => shift.id)).toEqual([
                "shift-1",
                "shift-2",
                "shift-3",
                "open-1",
                "open-2",
                "open-3",
                "open-4",
            ])
            expect(office.logEvidence.mock.calls).toEqual([
                [
                    "ws-1",
                    {
                        kind: "shifts.published",
                        actor: "Manager",
                        summary: text("shifts.publishEvidence", { week: "week:2026-10-12", people: 2 }),
                        evidence: `{"scheduleId":"schedule-1","shifts":8,"open":5}`,
                        workItemId: "work-1",
                    },
                ],
            ])
        })

        it.each([{ evidence: null }, { evidence: "old evidence" }, { evidence: [] }])(
            "replaces non-record evidence $evidence and skips notices for an empty schedule",
            async ({ evidence }) => {
                const em = mockEntityManager({ query: [PUBLISH_SCHEDULE, []] })
                const { service, data, notify, office } = await build(em)
                data.scheduleRow.mockResolvedValue(scheduleOf({ evidence }))

                await expect(service.performPublish(context)).resolves.toEqual({
                    summary: text("shifts.publishDone", { week: "week:2026-10-12", people: 0 }),
                    evidence: "captured",
                    detail: "3",
                })

                expect(em.query.mock.calls).toEqual([
                    [
                        PUBLISH_SCHEDULE,
                        ["ws-1", "schedule-1", `{"publish":{"by":"Manager","workItemId":"work-1"}}`, "work-1"],
                    ],
                ])
                expect(notify.toStaff).not.toHaveBeenCalled()
                expect(notify.toManagers).not.toHaveBeenCalled()
                expect(office.logEvidence.mock.calls).toEqual([
                    [
                        "ws-1",
                        {
                            kind: "shifts.published",
                            actor: "Manager",
                            summary: text("shifts.publishEvidence", { week: "week:2026-10-12", people: 0 }),
                            evidence: `{"scheduleId":"schedule-1","shifts":0,"open":0}`,
                            workItemId: "work-1",
                        },
                    ],
                ])
            },
        )

        it("refuses missing and superseded schedules without changing data", async () => {
            const em = mockEntityManager()
            const { service, data, notify, office } = await build(em)
            data.scheduleRow
                .mockResolvedValueOnce(undefined)
                .mockResolvedValueOnce(scheduleOf({ status: "superseded" }))

            await expect(service.performPublish(context)).rejects.toMatchObject({
                code: ShiftsErrorCode.ScheduleNotFound,
            })
            await expect(service.performPublish(context)).rejects.toMatchObject({
                code: ShiftsErrorCode.ScheduleNotDraft,
            })

            expect(em.query).not.toHaveBeenCalled()
            expect(notify.toStaff).not.toHaveBeenCalled()
            expect(office.logEvidence).not.toHaveBeenCalled()
        })
    })
})
