import { Test } from "@nestjs/testing"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { ActionPerformerRegistry, OfficeLog } from "@modules/domain/module-ops"
import type { PerformContext, PerformResult } from "@modules/domain/module-ops"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import {
    performerShiftOf as shiftOf,
    performerStaffOf as staffOf,
} from "@tests/fixtures/builders/shifts-performers.builder"
import { ShiftsErrorCode } from "./errors/shifts.error"
import { ShiftsCoverService } from "./shifts-cover.service"
import { ShiftsDataService } from "./shifts-data.service"
import { ShiftsNotifyService } from "./shifts-notify.service"
import type { StaffNotice } from "./shifts-notify.service"
import { ShiftsPerformersService } from "./shifts-performers.service"
import { ShiftsRequestsService } from "./shifts-requests.service"
import { ShiftsTextService } from "./shifts-text.service"
import type { Setup, SwapFinding } from "./shifts.contracts"
import { ShiftsLeaveRequestEntity, ShiftsScheduleEntity, ShiftsSwapRequestEntity } from "./persistence/entities"

const PUBLISH_SCHEDULE = "SELECT * FROM public.shifts_publish($1, $2, $3, $4)"
const DECIDE_SWAP = "SELECT * FROM public.shifts_decide_swap($1, $2, $3, $4, $5, $6)"
const DECIDE_LEAVE = "SELECT * FROM public.shifts_decide_leave($1, $2, $3, $4, $5, $6)"

type EvidenceEntry = Parameters<OfficeLog["logEvidence"]>[1]
const text = (key: string, params: Record<string, string | number> = {}): string => `${key}${JSON.stringify(params)}`

const workspaceCalls = <T>(...values: Array<T>) => values.map((value) => ["ws-1", value])

const noticeOf = builder<StaffNotice>({ staffId: "staff-1", kind: "publish", body: "" })
const evidenceOf = builder<EvidenceEntry>({
    kind: "shifts.published",
    actor: "Manager",
    summary: "",
    workItemId: "work-1",
})

const officeCalls = (entry: Partial<EvidenceEntry>) => workspaceCalls(evidenceOf(entry))
const staffCalls = (...notices: Array<Partial<StaffNotice>>) =>
    workspaceCalls(...notices.map((notice) => noticeOf(notice)))
const personalNotice = (staffId: string, params: Record<string, string | number>) =>
    noticeOf({
        staffId,
        scheduleId: "schedule-1",
        body: text("shifts.personalSchedule", { week: "week:2026-10-12", ...params }),
    })
const leaveStaffCalls = (key: string) =>
    staffCalls({ kind: "leave", body: text(key, { range: "range:2026-10-12:2026-10-13" }) })
const captured = (summary: string, detail?: string): PerformResult =>
    detail === undefined ? { summary, evidence: "captured" } : { summary, evidence: "captured", detail }

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

const scheduleOf = (
    status = "draft",
    evidence: ShiftsScheduleEntity["evidence"] = { solver: "fixed" },
): ShiftsScheduleEntity =>
    Object.assign(new ShiftsScheduleEntity(), {
        id: "schedule-1",
        weekStart: "2026-10-12",
        version: 3,
        status,
        costVnd: "60000",
        summary: {},
        evidence,
    })

const swapOf = (status = "pending", kind = "swap", fromStaffId: string | null = "staff-1"): ShiftsSwapRequestEntity =>
    Object.assign(new ShiftsSwapRequestEntity(), {
        id: "swap-1",
        kind,
        shiftId: "shift-1",
        fromStaffId,
        toStaffId: "staff-2",
        status,
    })

const leaveOf = (status = "pending"): ShiftsLeaveRequestEntity =>
    Object.assign(new ShiftsLeaveRequestEntity(), {
        id: "leave-1",
        staffId: "staff-1",
        fromDate: "2026-10-12",
        toDate: "2026-10-13",
        reason: "Travel",
        status,
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

const build = async (entityManager: MockEntityManager) => {
    const registry = mock<ActionPerformerRegistry>()
    const office = mock<OfficeLog>()
    const data = mock<ShiftsDataService>()
    data.scheduleRow.mockResolvedValue(scheduleOf())
    data.swapRow.mockResolvedValue(swapOf())
    data.leaveRow.mockResolvedValue(leaveOf())
    data.loadSetup.mockResolvedValue(setupOf())
    data.scheduleShifts.mockResolvedValue([])
    const words = mock<ShiftsTextService>()
    words.text.mockImplementation(text)
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
        const em = mockEntityManager({})
        const { service, registry, data, office } = await build(em)
        data.scheduleRow.mockResolvedValue(scheduleOf("published"))
        data.swapRow.mockResolvedValue(swapOf("approved"))
        data.leaveRow.mockResolvedValue(leaveOf("approved"))

        service.onModuleInit()

        expect(registry.add.mock.calls.map(([performer]) => performer.action)).toEqual([
            "publish_schedule",
            "approve_swap",
            "approve_leave",
        ])
        const [publish, swap, leave] = registry.add.mock.calls.map(([performer]) => performer)
        await expect(publish?.perform(context)).resolves.toEqual(
            captured(text("shifts.publishAlready", { week: "week:2026-10-12" })),
        )
        await expect(swap?.perform(context)).resolves.toEqual(captured(text("shifts.swapAlready")))
        await expect(leave?.perform(context)).resolves.toEqual(captured(text("shifts.leaveAlready")))
        await publish?.reject?.(context)
        await swap?.reject?.(context)
        await leave?.reject?.(context)

        expect(office.logEvidence.mock.calls).toEqual(
            officeCalls({
                kind: "shifts.publish_declined",
                summary: text("shifts.publishDeclined", { week: "week:2026-10-12" }),
            }),
        )
        expect(em.query).not.toHaveBeenCalled()
        expect(data.scheduleRow.mock.calls).toEqual(workspaceCalls("schedule-1"))
        expect(data.swapRow.mock.calls).toEqual(workspaceCalls("swap-1", "swap-1"))
        expect(data.leaveRow.mock.calls).toEqual(workspaceCalls("leave-1", "leave-1"))
    })

    it.each([
        { action: "swap", code: ShiftsErrorCode.ShiftNotFound, summary: "shifts.swapHandled" },
        { action: "leave", code: ShiftsErrorCode.StaffNotFound, summary: "shifts.leaveHandled" },
    ])("refuses missing $action requests and leaves settled requests alone", async ({ action, code, summary }) => {
        const em = mockEntityManager({})
        const { service, data, requests, notify } = await build(em)
        if (action === "swap") data.swapRow.mockResolvedValueOnce(undefined).mockResolvedValueOnce(swapOf("declined"))
        else data.leaveRow.mockResolvedValueOnce(undefined).mockResolvedValueOnce(leaveOf("declined"))
        const perform = action === "swap" ? service.performSwap.bind(service) : service.performLeave.bind(service)
        await expect(perform(context)).rejects.toMatchObject({ code })
        await expect(perform(context)).resolves.toEqual({ summary: text(summary), evidence: "pending" })
        expect(requests.checkSwap).not.toHaveBeenCalled()
        expect(em.query).not.toHaveBeenCalled()
        expect(notify.toStaff).not.toHaveBeenCalled()
    })

    it.each(["swap", "leave"])("ignores missing or handled %s rejections", async (action) => {
        const em = mockEntityManager({})
        const { service, data, notify } = await build(em)
        if (action === "swap") data.swapRow.mockResolvedValueOnce(undefined).mockResolvedValueOnce(swapOf("declined"))
        else data.leaveRow.mockResolvedValueOnce(undefined).mockResolvedValueOnce(leaveOf("declined"))
        const reject = action === "swap" ? service.rejectSwap.bind(service) : service.rejectLeave.bind(service)
        await reject(context)
        await reject(context)
        expect(em.query).not.toHaveBeenCalled()
        expect(notify.toStaff).not.toHaveBeenCalled()
    })
})

describe("ShiftsPerformersService performPublish", () => {
    it.each([
        {
            evidence: { solver: "fixed" },
            populated: true,
            publishEvidence: '{"solver":"fixed","publish":{"by":"Manager","workItemId":"work-1"}}',
        },
        ...[null, "old evidence", []].map((evidence) => ({
            evidence,
            populated: false,
            publishEvidence: '{"publish":{"by":"Manager","workItemId":"work-1"}}',
        })),
    ])(
        "publishes grouped shifts or an empty schedule with evidence $evidence",
        async ({ evidence, populated, publishEvidence }) => {
            const em = mockEntityManager({ query: [PUBLISH_SCHEDULE, []] })
            const { service, data, notify, office, words } = await build(em)
            data.scheduleRow.mockResolvedValue(scheduleOf("draft", evidence))
            data.scheduleShifts.mockResolvedValue(
                populated
                    ? [
                          shiftOf(),
                          shiftOf({ id: "shift-2", start: "10:30", end: "13:00" }),
                          shiftOf({ id: "shift-3", staffId: "staff-2", end: "11:00" }),
                          ...["open-1", "open-2", "open-3", "open-4", "open-5"].map((id) =>
                              shiftOf({ id, staffId: null }),
                          ),
                          shiftOf({ id: "draft-1", status: "draft" }),
                      ]
                    : [],
            )
            const people = populated ? 2 : 0

            await expect(service.performPublish(context)).resolves.toEqual(
                captured(text("shifts.publishDone", { week: "week:2026-10-12", people }), "3"),
            )

            expect(em.query.mock.calls).toEqual([[PUBLISH_SCHEDULE, ["ws-1", "schedule-1", publishEvidence, "work-1"]]])
            expect(data.loadSetup.mock.calls).toEqual(workspaceCalls(false))
            expect(data.scheduleShifts.mock.calls).toEqual(workspaceCalls("schedule-1"))
            expect(notify.toStaff.mock.calls).toEqual(
                populated
                    ? staffCalls(
                          personalNotice("staff-1", {
                              count: 2,
                              hours: 4.5,
                              lines: "- line:shift-1\n- line:shift-2",
                          }),
                          personalNotice("staff-2", { count: 1, hours: 3, lines: "- line:shift-3" }),
                      )
                    : [],
            )
            expect(notify.toManagers.mock.calls).toEqual(
                populated
                    ? workspaceCalls(
                          text("shifts.gapOffice", {
                              count: 5,
                              week: "week:2026-10-12",
                              lines: "line:open-1; line:open-2; line:open-3; line:open-4",
                          }),
                      )
                    : [],
            )
            expect(words.line.mock.calls.map(([, shift]) => shift.id)).toEqual(
                populated ? ["shift-1", "shift-2", "shift-3", "open-1", "open-2", "open-3", "open-4"] : [],
            )
            expect(office.logEvidence.mock.calls).toEqual(
                officeCalls({
                    summary: text("shifts.publishEvidence", { week: "week:2026-10-12", people }),
                    evidence: populated
                        ? '{"scheduleId":"schedule-1","shifts":8,"open":5}'
                        : '{"scheduleId":"schedule-1","shifts":0,"open":0}',
                }),
            )
        },
    )
})

describe("ShiftsPerformersService performPublish", () => {
    it("refuses missing and superseded schedules without changing data", async () => {
        const em = mockEntityManager({})
        const { service, data, notify, office } = await build(em)
        data.scheduleRow.mockResolvedValueOnce(undefined).mockResolvedValueOnce(scheduleOf("superseded"))

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

describe("ShiftsPerformersService performSwap", () => {
    it.each([
        {
            kind: "swap",
            fromStaffId: "staff-1",
            findings: [{ code: "notice", params: { hours: 12 } }],
            sentences: [text("shifts.finding.notice", { hours: 12 })],
        },
        { kind: "claim", fromStaffId: null, findings: [], sentences: [] },
    ])("approves $kind and notifies its participants", async ({ kind, fromStaffId, findings, sentences }) => {
        const em = mockEntityManager({ query: [DECIDE_SWAP, [{ shifts_decide_swap: true }]] })
        const { service, data, requests, notify, office } = await build(em)
        data.swapRow.mockResolvedValue(swapOf("pending", kind, fromStaffId))
        requests.checkSwap.mockResolvedValue({ shift: shiftOf(), setup: setupOf(), findings })
        const resultParams = { kind: text(`shifts.swapKind.${kind}`), line: "line:shift-1", to: "Bob" }

        await expect(service.performSwap(context)).resolves.toEqual(captured(text("shifts.swapApproved", resultParams)))

        expect(requests.checkSwap.mock.calls).toEqual([
            ["ws-1", { kind, fromStaffId, toStaffId: "staff-2" }, "shift-1"],
        ])
        expect(em.query.mock.calls).toEqual([
            [DECIDE_SWAP, ["ws-1", "swap-1", "approved", "Manager", JSON.stringify(sentences), "work-1"]],
        ])
        const toNotice = noticeOf({
            staffId: "staff-2",
            kind: "swap",
            shiftId: "shift-1",
            body: text("shifts.swapDoneTo", { line: "line:shift-1" }),
        })
        const fromNotice = noticeOf({
            kind: "swap",
            shiftId: "shift-1",
            body: text("shifts.swapDoneFrom", { line: "line:shift-1", to: "Bob" }),
        })
        expect(notify.toStaff.mock.calls).toEqual(
            fromStaffId === null ? workspaceCalls(toNotice) : workspaceCalls(toNotice, fromNotice),
        )
        expect(office.logEvidence.mock.calls).toEqual(
            officeCalls({
                kind: "shifts.swap_approved",
                summary: text("shifts.swapEvidence", resultParams),
                evidence: sentences.join(" "),
            }),
        )
    })

    it.each([false, true])("refuses hard findings or a disappeared shift (missing=%s)", async (missing) => {
        const em = mockEntityManager({})
        const { service, requests, words, notify } = await build(em)
        const hard: ReadonlyArray<SwapFinding> = missing
            ? []
            : ["shift-missing", "not-posted", "not-owner", "taken", "taker-gone", "started"].map((code) => ({
                  code,
                  params: {},
              }))
        requests.checkSwap.mockResolvedValue({
            shift: missing ? undefined : shiftOf(),
            setup: setupOf(),
            findings: missing ? [] : [...hard, { code: "notice", params: { hours: 12 } }],
        })
        await expect(service.performSwap(context)).rejects.toMatchObject({
            code: ShiftsErrorCode.SwapRefused,
            params: { reasons: hard.map((finding) => text(`shifts.finding.${finding.code}`)).join(" ") },
        })
        expect(words.findings.mock.calls).toEqual([[hard]])
        expect(em.query).not.toHaveBeenCalled()
        expect(notify.toStaff).not.toHaveBeenCalled()
    })
})

describe("ShiftsPerformersService performSwap", () => {
    it.each([{ rows: [] }, { rows: [{ shifts_decide_swap: false }] }])(
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
})

describe("ShiftsPerformersService", () => {
    it.each([
        { kind: "swap", fromStaffId: "staff-1", recipient: "staff-1" },
        { kind: "claim", fromStaffId: null, recipient: "staff-2" },
    ])("declines a pending $kind and tells its recipient", async ({ kind, fromStaffId, recipient }) => {
        const em = mockEntityManager({ query: [DECIDE_SWAP, []] })
        const { service, data, notify } = await build(em)
        data.swapRow.mockResolvedValue(swapOf("pending", kind, fromStaffId))

        await service.rejectSwap(context)

        expect(em.query.mock.calls).toEqual([[DECIDE_SWAP, ["ws-1", "swap-1", "declined", "Manager", null, "work-1"]]])
        expect(notify.toStaff.mock.calls).toEqual(
            staffCalls({ staffId: recipient, kind: "swap", body: text("shifts.swapDeclined") }),
        )
    })
})

describe("ShiftsPerformersService performLeave", () => {
    it.each([
        { rows: [{ shifts_decide_leave: ["shift-1", "shift-2"] }], opened: ["shift-1", "shift-2"], count: 2 },
        { rows: [], opened: [], count: 0 },
        { rows: [{ shifts_decide_leave: null }], opened: [], count: 0 },
        { rows: [{ shifts_decide_leave: [] }], opened: [], count: 0 },
    ])("records leave and sends notices for $rows", async ({ rows, opened, count }) => {
        const em = mockEntityManager({ query: [DECIDE_LEAVE, rows] })
        const { service, data, notify, cover, office } = await build(em)

        await expect(service.performLeave(context)).resolves.toEqual(
            captured(text("shifts.leaveApproved", { name: "Alice", count })),
        )

        expect(data.loadSetup.mock.calls).toEqual(workspaceCalls(false))
        expect(em.query.mock.calls).toEqual([
            [
                DECIDE_LEAVE,
                ["ws-1", "leave-1", "approved", "Manager", "work-1", text("shifts.leaveNote", { name: "Alice" })],
            ],
        ])
        expect(notify.toStaff.mock.calls).toEqual(leaveStaffCalls("shifts.leaveDoneStaff"))
        expect(cover.suggestions.mock.calls).toEqual(count === 0 ? [] : [["ws-1", opened, "staff-1"]])
        expect(notify.toManagers.mock.calls).toEqual(
            count === 0
                ? []
                : workspaceCalls(
                      text("shifts.leaveGapOffice", {
                          name: "Alice",
                          count: 2,
                          lines: "Alice can cover; Bob can cover",
                      }),
                  ),
        )
        expect(office.logEvidence.mock.calls).toEqual(
            officeCalls({
                kind: "shifts.leave_approved",
                summary: text("shifts.leaveEvidence", {
                    name: "Alice",
                    range: "range:2026-10-12:2026-10-13",
                    count,
                }),
                evidence: "leave-1",
            }),
        )
    })
})

describe("ShiftsPerformersService", () => {
    it("declines pending leave and tells the staff member the range", async () => {
        const em = mockEntityManager({ query: [DECIDE_LEAVE, []] })
        const { service, notify } = await build(em)

        await service.rejectLeave(context)

        expect(em.query.mock.calls).toEqual([[DECIDE_LEAVE, ["ws-1", "leave-1", "declined", "Manager", "work-1", ""]]])
        expect(notify.toStaff.mock.calls).toEqual(leaveStaffCalls("shifts.leaveDeclined"))
    })
})
