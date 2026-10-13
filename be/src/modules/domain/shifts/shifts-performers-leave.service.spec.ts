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
import { DECIDE_LEAVE } from "./persistence/shifts.sql"

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

describe("ShiftsPerformersService leave actions", () => {
    describe("performLeave", () => {
        it("opens shifts, tells the staff member and sends cover suggestions to managers", async () => {
            const em = mockEntityManager({ query: [DECIDE_LEAVE, [{ opened: ["shift-1", "shift-2"] }]] })
            const { service, data, notify, cover, office } = await build(em)

            await expect(service.performLeave(context)).resolves.toEqual({
                summary: text("shifts.leaveApproved", { name: "Alice", count: 2 }),
                evidence: "captured",
            })

            expect(data.loadSetup.mock.calls).toEqual([["ws-1", false]])
            expect(em.query.mock.calls).toEqual([
                [
                    DECIDE_LEAVE,
                    ["ws-1", "leave-1", "approved", "Manager", "work-1", text("shifts.leaveNote", { name: "Alice" })],
                ],
            ])
            expect(notify.toStaff.mock.calls).toEqual([
                [
                    "ws-1",
                    {
                        staffId: "staff-1",
                        kind: "leave",
                        body: text("shifts.leaveDoneStaff", { range: "range:2026-10-12:2026-10-13" }),
                    },
                ],
            ])
            expect(cover.suggestions.mock.calls).toEqual([["ws-1", ["shift-1", "shift-2"], "staff-1"]])
            expect(notify.toManagers.mock.calls).toEqual([
                [
                    "ws-1",
                    text("shifts.leaveGapOffice", {
                        name: "Alice",
                        count: 2,
                        lines: "Alice can cover; Bob can cover",
                    }),
                ],
            ])
            expect(office.logEvidence.mock.calls).toEqual([
                [
                    "ws-1",
                    {
                        kind: "shifts.leave_approved",
                        actor: "Manager",
                        summary: text("shifts.leaveEvidence", {
                            name: "Alice",
                            range: "range:2026-10-12:2026-10-13",
                            count: 2,
                        }),
                        evidence: "leave-1",
                        workItemId: "work-1",
                    },
                ],
            ])
        })

        it.each([{ rows: [] }, { rows: [{ opened: null }] }, { rows: [{ opened: [] }] }])(
            "records leave with no opened shifts for $rows",
            async ({ rows }) => {
                const em = mockEntityManager({ query: [DECIDE_LEAVE, rows] })
                const { service, notify, cover, office } = await build(em)

                await expect(service.performLeave(context)).resolves.toEqual({
                    summary: text("shifts.leaveApproved", { name: "Alice", count: 0 }),
                    evidence: "captured",
                })

                expect(notify.toStaff.mock.calls).toEqual([
                    [
                        "ws-1",
                        {
                            staffId: "staff-1",
                            kind: "leave",
                            body: text("shifts.leaveDoneStaff", { range: "range:2026-10-12:2026-10-13" }),
                        },
                    ],
                ])
                expect(cover.suggestions).not.toHaveBeenCalled()
                expect(notify.toManagers).not.toHaveBeenCalled()
                expect(office.logEvidence.mock.calls).toEqual([
                    [
                        "ws-1",
                        {
                            kind: "shifts.leave_approved",
                            actor: "Manager",
                            summary: text("shifts.leaveEvidence", {
                                name: "Alice",
                                range: "range:2026-10-12:2026-10-13",
                                count: 0,
                            }),
                            evidence: "leave-1",
                            workItemId: "work-1",
                        },
                    ],
                ])
            },
        )

        it("refuses a missing request and leaves a settled request alone", async () => {
            const em = mockEntityManager()
            const { service, data, notify } = await build(em)
            data.leaveRow.mockResolvedValueOnce(undefined).mockResolvedValueOnce(leaveOf({ status: "declined" }))

            await expect(service.performLeave(context)).rejects.toMatchObject({ code: ShiftsErrorCode.StaffNotFound })
            await expect(service.performLeave(context)).resolves.toEqual({
                summary: text("shifts.leaveHandled"),
                evidence: "pending",
            })

            expect(em.query).not.toHaveBeenCalled()
            expect(notify.toStaff).not.toHaveBeenCalled()
        })
    })

    describe("rejectLeave", () => {
        it("declines pending leave and tells the staff member the range", async () => {
            const em = mockEntityManager({ query: [DECIDE_LEAVE, []] })
            const { service, notify } = await build(em)

            await service.rejectLeave(context)

            expect(em.query.mock.calls).toEqual([
                [DECIDE_LEAVE, ["ws-1", "leave-1", "declined", "Manager", "work-1", ""]],
            ])
            expect(notify.toStaff.mock.calls).toEqual([
                [
                    "ws-1",
                    {
                        staffId: "staff-1",
                        kind: "leave",
                        body: text("shifts.leaveDeclined", { range: "range:2026-10-12:2026-10-13" }),
                    },
                ],
            ])
        })

        it("ignores missing or already handled requests", async () => {
            const em = mockEntityManager()
            const { service, data, notify } = await build(em)
            data.leaveRow.mockResolvedValueOnce(undefined).mockResolvedValueOnce(leaveOf({ status: "declined" }))

            await service.rejectLeave(context)
            await service.rejectLeave(context)

            expect(em.query).not.toHaveBeenCalled()
            expect(notify.toStaff).not.toHaveBeenCalled()
        })
    })
})
