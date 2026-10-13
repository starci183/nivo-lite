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
import type { Setup, Shift, ShiftStaff, SwapFinding } from "./shifts.contracts"
import type { ShiftsLeaveRow, ShiftsScheduleRow, ShiftsSwapRow } from "./persistence/shifts.rows"
import { DECIDE_SWAP } from "./persistence/shifts.sql"

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

describe("ShiftsPerformersService swap actions", () => {
    describe("performSwap", () => {
        it("approves a swap with soft findings and tells both people", async () => {
            const em = mockEntityManager({ query: [DECIDE_SWAP, [{ settled: true }]] })
            const { service, requests, notify, office } = await build(em)
            const findings: ReadonlyArray<SwapFinding> = [{ code: "notice", params: { hours: 12 } }]
            requests.checkSwap.mockResolvedValue({ shift: shiftOf(), setup: setupOf(), findings })
            const sentence = text("shifts.finding.notice", { hours: 12 })

            await expect(service.performSwap(context)).resolves.toEqual({
                summary: text("shifts.swapApproved", {
                    kind: text("shifts.swapKind.swap"),
                    line: "line:shift-1",
                    to: "Bob",
                }),
                evidence: "captured",
            })

            expect(requests.checkSwap.mock.calls).toEqual([
                ["ws-1", { kind: "swap", fromStaffId: "staff-1", toStaffId: "staff-2" }, "shift-1"],
            ])
            expect(em.query.mock.calls).toEqual([
                [DECIDE_SWAP, ["ws-1", "swap-1", "approved", "Manager", JSON.stringify([sentence]), "work-1"]],
            ])
            expect(notify.toStaff.mock.calls).toEqual([
                [
                    "ws-1",
                    {
                        staffId: "staff-2",
                        kind: "swap",
                        shiftId: "shift-1",
                        body: text("shifts.swapDoneTo", { line: "line:shift-1" }),
                    },
                ],
                [
                    "ws-1",
                    {
                        staffId: "staff-1",
                        kind: "swap",
                        shiftId: "shift-1",
                        body: text("shifts.swapDoneFrom", { line: "line:shift-1", to: "Bob" }),
                    },
                ],
            ])
            expect(office.logEvidence.mock.calls).toEqual([
                [
                    "ws-1",
                    {
                        kind: "shifts.swap_approved",
                        actor: "Manager",
                        summary: text("shifts.swapEvidence", {
                            kind: text("shifts.swapKind.swap"),
                            line: "line:shift-1",
                            to: "Bob",
                        }),
                        evidence: sentence,
                        workItemId: "work-1",
                    },
                ],
            ])
        })

        it("approves a claim without notifying a previous owner", async () => {
            const em = mockEntityManager({ query: [DECIDE_SWAP, [{ settled: true }]] })
            const { service, data, requests, notify, office } = await build(em)
            data.swapRow.mockResolvedValue(swapOf({ kind: "claim", from_staff_id: null }))

            await expect(service.performSwap(context)).resolves.toEqual({
                summary: text("shifts.swapApproved", {
                    kind: text("shifts.swapKind.claim"),
                    line: "line:shift-1",
                    to: "Bob",
                }),
                evidence: "captured",
            })

            expect(requests.checkSwap.mock.calls).toEqual([
                ["ws-1", { kind: "claim", fromStaffId: null, toStaffId: "staff-2" }, "shift-1"],
            ])
            expect(em.query.mock.calls).toEqual([
                [DECIDE_SWAP, ["ws-1", "swap-1", "approved", "Manager", "[]", "work-1"]],
            ])
            expect(notify.toStaff.mock.calls).toEqual([
                [
                    "ws-1",
                    {
                        staffId: "staff-2",
                        kind: "swap",
                        shiftId: "shift-1",
                        body: text("shifts.swapDoneTo", { line: "line:shift-1" }),
                    },
                ],
            ])
            expect(office.logEvidence.mock.calls).toEqual([
                [
                    "ws-1",
                    {
                        kind: "shifts.swap_approved",
                        actor: "Manager",
                        summary: text("shifts.swapEvidence", {
                            kind: text("shifts.swapKind.claim"),
                            line: "line:shift-1",
                            to: "Bob",
                        }),
                        evidence: "",
                        workItemId: "work-1",
                    },
                ],
            ])
        })

        it("refuses every hard finding even when the owner approved", async () => {
            const em = mockEntityManager()
            const { service, requests, words, notify } = await build(em)
            const hard: ReadonlyArray<SwapFinding> = [
                "shift-missing",
                "not-posted",
                "not-owner",
                "taken",
                "taker-gone",
                "started",
            ].map((code) => ({ code, params: {} }))
            requests.checkSwap.mockResolvedValue({
                shift: shiftOf(),
                setup: setupOf(),
                findings: [...hard, { code: "notice", params: { hours: 12 } }],
            })

            await expect(service.performSwap(context)).rejects.toMatchObject({
                code: ShiftsErrorCode.SwapRefused,
                params: { reasons: hard.map((finding) => text(`shifts.finding.${finding.code}`)).join(" ") },
            })

            expect(words.findings.mock.calls).toEqual([[hard]])
            expect(em.query).not.toHaveBeenCalled()
            expect(notify.toStaff).not.toHaveBeenCalled()
        })

        it("refuses when the checked shift disappeared without findings", async () => {
            const em = mockEntityManager()
            const { service, requests } = await build(em)
            requests.checkSwap.mockResolvedValue({ shift: undefined, setup: setupOf(), findings: [] })

            await expect(service.performSwap(context)).rejects.toMatchObject({
                code: ShiftsErrorCode.SwapRefused,
                params: { reasons: "" },
            })

            expect(em.query).not.toHaveBeenCalled()
        })

        it.each([{ rows: [] }, { rows: [{ settled: false }] }])(
            "reports a settlement race for $rows without sending notices",
            async ({ rows }) => {
                const em = mockEntityManager({ query: [DECIDE_SWAP, rows] })
                const { service, notify, office } = await build(em)

                await expect(service.performSwap(context)).resolves.toEqual({
                    summary: text("shifts.swapHandled"),
                    evidence: "pending",
                })

                expect(em.query.mock.calls).toEqual([
                    [DECIDE_SWAP, ["ws-1", "swap-1", "approved", "Manager", "[]", "work-1"]],
                ])
                expect(notify.toStaff).not.toHaveBeenCalled()
                expect(office.logEvidence).not.toHaveBeenCalled()
            },
        )

        it("refuses a missing request and leaves a settled request alone", async () => {
            const em = mockEntityManager()
            const { service, data, requests } = await build(em)
            data.swapRow.mockResolvedValueOnce(undefined).mockResolvedValueOnce(swapOf({ status: "declined" }))

            await expect(service.performSwap(context)).rejects.toMatchObject({ code: ShiftsErrorCode.ShiftNotFound })
            await expect(service.performSwap(context)).resolves.toEqual({
                summary: text("shifts.swapHandled"),
                evidence: "pending",
            })

            expect(requests.checkSwap).not.toHaveBeenCalled()
            expect(em.query).not.toHaveBeenCalled()
        })
    })

    describe("rejectSwap", () => {
        it("declines a pending swap and tells the offering staff member", async () => {
            const em = mockEntityManager({ query: [DECIDE_SWAP, []] })
            const { service, notify } = await build(em)

            await service.rejectSwap(context)

            expect(em.query.mock.calls).toEqual([
                [DECIDE_SWAP, ["ws-1", "swap-1", "declined", "Manager", null, "work-1"]],
            ])
            expect(notify.toStaff.mock.calls).toEqual([
                ["ws-1", { staffId: "staff-1", kind: "swap", body: text("shifts.swapDeclined") }],
            ])
        })

        it("declines a pending claim and tells the taking staff member", async () => {
            const em = mockEntityManager({ query: [DECIDE_SWAP, []] })
            const { service, data, notify } = await build(em)
            data.swapRow.mockResolvedValue(swapOf({ kind: "claim", from_staff_id: null }))

            await service.rejectSwap(context)

            expect(em.query.mock.calls).toEqual([
                [DECIDE_SWAP, ["ws-1", "swap-1", "declined", "Manager", null, "work-1"]],
            ])
            expect(notify.toStaff.mock.calls).toEqual([
                ["ws-1", { staffId: "staff-2", kind: "swap", body: text("shifts.swapDeclined") }],
            ])
        })

        it("ignores missing or already handled requests", async () => {
            const em = mockEntityManager()
            const { service, data, notify } = await build(em)
            data.swapRow.mockResolvedValueOnce(undefined).mockResolvedValueOnce(swapOf({ status: "declined" }))

            await service.rejectSwap(context)
            await service.rejectSwap(context)

            expect(em.query).not.toHaveBeenCalled()
            expect(notify.toStaff).not.toHaveBeenCalled()
        })
    })
})
