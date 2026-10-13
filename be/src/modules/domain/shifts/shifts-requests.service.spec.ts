import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { ApprovalGate } from "@modules/domain/module-ops"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { MessageCatalog } from "@modules/platform/i18n"
import { ShiftsErrorCode } from "./errors/shifts.error"
import { CREATE_LEAVE, CREATE_SWAP, LINK_LEAVE, LINK_SWAP } from "./persistence/shifts.sql"
import type { ShiftsShiftRow } from "./persistence/shifts.rows"
import { ShiftsDataService } from "./shifts-data.service"
import { ShiftsRequestsService } from "./shifts-requests.service"
import { ShiftsTextService } from "./shifts-text.service"
import type { Env, Setup, Shift, ShiftStaff } from "./shifts.contracts"

const text = (key: string, params: Record<string, string | number> = {}): string => `${key}${JSON.stringify(params)}`

const person = (id: string, name: string): ShiftStaff => ({
    id,
    name,
    positionIds: ["position-1"],
    skills: [],
    wage: 30000,
    maxWeek: 48,
    maxDay: 10,
    minRest: 10,
    staffRowId: null,
    telegramChatId: null,
    zaloUserId: null,
    phone: null,
    active: true,
})

const setupOf = (staff: ReadonlyArray<ShiftStaff> = [person("staff-1", "Alice"), person("staff-2", "Bob")]): Setup => ({
    positions: [{ id: "position-1", name: "Cashier", color: "#123456" }],
    staff,
    blocks: [],
    settings: {
        openingHours: [],
        swapNoticeHours: 24,
        leaveNoticeDays: 2,
        remindMinutes: 60,
        noshowMinutes: 10,
        overtimeHoursWeek: 48,
    },
})

const rowOf = (overrides: Partial<ShiftsShiftRow> = {}): ShiftsShiftRow => ({
    id: "shift-1",
    schedule_id: "schedule-1",
    shift_date: "2026-10-15",
    start_time: "09:00:00",
    end_time: "13:00:00",
    position_id: "position-1",
    staff_id: "staff-1",
    status: "published",
    schedule_status: "published",
    week_start: "2026-10-12",
    ...overrides,
})

const shift: Shift = {
    id: "shift-1",
    date: "2026-10-15",
    start: "09:00",
    end: "13:00",
    positionId: "position-1",
    staffId: "staff-1",
    status: "published",
}

const build = async (entityManager: MockEntityManager, setup = setupOf()) => {
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => text(key, params))
    const words = mock<ShiftsTextService>()
    words.text.mockImplementation((key, params) => catalog.get(key, params ?? {}, "vi"))
    words.line.mockReturnValue("shift line")
    words.range.mockReturnValue("leave range")
    words.findings.mockImplementation((findings) =>
        findings.map((finding) => catalog.get(`shifts.finding.${finding.code}`, { ...finding.params }, "vi")),
    )
    const members = mock<WorkspaceMembersService>()
    members.require.mockResolvedValue({
        userId: "user-1",
        workspaceId: "ws-1",
        role: "staff",
        staffId: null,
        displayName: "Alice",
        status: "active",
    })
    const data = mock<ShiftsDataService>()
    const env: Env = {
        staff: new Map(setup.staff.map((item) => [item.id, item])),
        avail: [],
        leaves: [],
        overtimeHoursWeek: 48,
    }
    data.profileOf.mockResolvedValue("staff-1")
    data.shiftRow.mockResolvedValue(rowOf())
    data.loadSetup.mockResolvedValue(setup)
    data.loadEnv.mockResolvedValue(env)
    data.staffShifts.mockResolvedValue([])
    const gate = mock<ApprovalGate>()
    gate.request.mockResolvedValue({ status: "waiting_decision", workItemId: "work-1" })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ShiftsRequestsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock("2026-10-12T00:00:00.000Z") },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: ShiftsDataService, useValue: data },
            { provide: ShiftsTextService, useValue: words },
            { provide: ApprovalGate, useValue: gate },
        ],
    }).compile()
    return { service: moduleRef.get(ShiftsRequestsService), catalog, words, members, data, gate, setup, env }
}

describe("ShiftsRequestsService", () => {
    describe("requestSwap", () => {
        it("records a clean handover and links the owner's decision", async () => {
            const em = mockEntityManager({
                query: [
                    [CREATE_SWAP, [{ id: "swap-1" }]],
                    [LINK_SWAP, []],
                ],
            })
            const { service, words, members, data, gate, setup } = await build(em)

            await expect(
                service.requestSwap("user-1", "ws-1", {
                    kind: "swap",
                    shiftId: "shift-1",
                    toStaffId: "staff-2",
                    reason: "Appointment",
                }),
            ).resolves.toEqual({ status: "waiting_decision" })

            expect(members.require.mock.calls).toEqual([["user-1", "ws-1", []]])
            expect(data.profileOf.mock.calls).toEqual([["ws-1", "user-1"]])
            expect(words.findings.mock.calls).toEqual([[[]]])
            expect(words.line.mock.calls).toEqual([[setup, shift]])
            expect(gate.request.mock.calls).toEqual([
                [
                    {
                        workspaceId: "ws-1",
                        actor: "Alice",
                        action: "approve_swap",
                        subjectType: "shift_swap",
                        subjectId: "swap-1",
                        dedupeKey: "approve_swap:swap-1",
                        summary: text("shifts.swapAskSummary", {
                            kind: text("shifts.swapKind.swap"),
                            line: "shift line",
                            from: "Alice",
                            to: "Bob",
                            findings: text("shifts.swapClean"),
                        }),
                        fields: { swap_id: "swap-1", clean: true },
                    },
                ],
            ])
            expect(em.query.mock.calls).toEqual([
                [CREATE_SWAP, ["ws-1", "swap", "shift-1", "staff-1", "staff-2", "Appointment"]],
                [LINK_SWAP, ["ws-1", "swap-1", "[]", "work-1"]],
            ])
        })

        it("claims an open shift for the asking member and keeps every finding", async () => {
            const em = mockEntityManager({
                query: [
                    [CREATE_SWAP, []],
                    [LINK_SWAP, []],
                ],
            })
            const { service, data, gate, words } = await build(em)
            data.shiftRow.mockResolvedValue(rowOf({ staff_id: null, status: "draft" }))
            data.staffShifts.mockResolvedValue([{ ...shift, id: "other", staffId: "staff-1" }])
            gate.request.mockResolvedValue({ status: "done", workItemId: "work-2" })
            const sentences = [
                text("shifts.finding.not-posted"),
                text("shifts.finding.rule-overlap", { name: "Alice" }),
            ]

            await expect(
                service.requestSwap("user-1", "ws-1", {
                    kind: "claim",
                    shiftId: "shift-1",
                    toStaffId: null,
                    reason: "Available",
                }),
            ).resolves.toEqual({ status: "done" })

            expect(words.findings.mock.calls).toEqual([
                [
                    [
                        { code: "not-posted", params: {} },
                        { code: "rule-overlap", params: { name: "Alice" } },
                    ],
                ],
            ])
            expect(gate.request.mock.calls).toEqual([
                [
                    {
                        workspaceId: "ws-1",
                        actor: "Alice",
                        action: "approve_swap",
                        subjectType: "shift_swap",
                        subjectId: "",
                        dedupeKey: "approve_swap:",
                        summary: text("shifts.swapAskSummary", {
                            kind: text("shifts.swapKind.claim"),
                            line: "shift line",
                            from: "-",
                            to: "Alice",
                            findings: sentences.join(" "),
                        }),
                        fields: { swap_id: "", clean: false },
                    },
                ],
            ])
            expect(em.query.mock.calls).toEqual([
                [CREATE_SWAP, ["ws-1", "claim", "shift-1", null, "staff-1", "Available"]],
                [LINK_SWAP, ["ws-1", "", JSON.stringify(sentences), "work-2"]],
            ])
        })

        it("uses fallback names when the setup no longer contains either person", async () => {
            const em = mockEntityManager({
                query: [
                    [CREATE_SWAP, [{ id: "swap-2" }]],
                    [LINK_SWAP, []],
                ],
            })
            const { service, gate } = await build(em, setupOf([]))

            await service.requestSwap("user-1", "ws-1", {
                kind: "swap",
                shiftId: "shift-1",
                toStaffId: "gone",
                reason: "",
            })

            expect(gate.request.mock.calls).toEqual([
                [
                    {
                        workspaceId: "ws-1",
                        actor: "Alice",
                        action: "approve_swap",
                        subjectType: "shift_swap",
                        subjectId: "swap-2",
                        dedupeKey: "approve_swap:swap-2",
                        summary: text("shifts.swapAskSummary", {
                            kind: text("shifts.swapKind.swap"),
                            line: "shift line",
                            from: "-",
                            to: "-",
                            findings: text("shifts.finding.taker-gone"),
                        }),
                        fields: { swap_id: "swap-2", clean: false },
                    },
                ],
            ])
        })

        it("refuses a request without a linked profile", async () => {
            const em = mockEntityManager()
            const { service, data, gate } = await build(em)
            data.profileOf.mockResolvedValue(null)

            await expect(
                service.requestSwap("user-1", "ws-1", {
                    kind: "claim",
                    shiftId: "shift-1",
                    toStaffId: null,
                    reason: "",
                }),
            ).rejects.toMatchObject({ code: ShiftsErrorCode.ProfileMissing })

            expect(data.shiftRow).not.toHaveBeenCalled()
            expect(gate.request).not.toHaveBeenCalled()
            expect(em.query).not.toHaveBeenCalled()
        })

        it("requires a recipient for a handover", async () => {
            const em = mockEntityManager()
            const { service, data, gate } = await build(em)

            await expect(
                service.requestSwap("user-1", "ws-1", {
                    kind: "swap",
                    shiftId: "shift-1",
                    toStaffId: null,
                    reason: "",
                }),
            ).rejects.toMatchObject({ code: ShiftsErrorCode.StaffNotFound })

            expect(data.shiftRow).not.toHaveBeenCalled()
            expect(gate.request).not.toHaveBeenCalled()
            expect(em.query).not.toHaveBeenCalled()
        })

        it("does not record a request for a missing shift", async () => {
            const em = mockEntityManager()
            const { service, data, gate } = await build(em)
            data.shiftRow.mockResolvedValue(undefined)

            await expect(
                service.requestSwap("user-1", "ws-1", {
                    kind: "swap",
                    shiftId: "missing",
                    toStaffId: "staff-2",
                    reason: "",
                }),
            ).rejects.toMatchObject({ code: ShiftsErrorCode.ShiftNotFound })

            expect(gate.request).not.toHaveBeenCalled()
            expect(em.query).not.toHaveBeenCalled()
        })
    })

    describe("checkSwap", () => {
        it("checks the recipient's posted work in the shift's week", async () => {
            const { service, data, setup, env } = await build(mockEntityManager())
            data.shiftRow.mockResolvedValue(rowOf({ shift_date: "2026-11-05" }))
            data.staffShifts.mockResolvedValue([{ ...shift, id: "existing", date: "2026-11-05", staffId: "staff-2" }])

            await expect(
                service.checkSwap("ws-1", { kind: "swap", fromStaffId: "staff-1", toStaffId: "staff-2" }, "shift-1"),
            ).resolves.toEqual({
                shift: { ...shift, date: "2026-11-05" },
                setup,
                findings: [{ code: "rule-overlap", params: { name: "Bob" } }],
            })

            expect(data.shiftRow.mock.calls).toEqual([["ws-1", "shift-1"]])
            expect(data.loadSetup.mock.calls).toEqual([["ws-1", false]])
            expect(data.loadEnv.mock.calls).toEqual([["ws-1", "2026-11-02", setup]])
            expect(data.staffShifts.mock.calls).toEqual([
                ["ws-1", "staff-2", "2026-11-02", "2026-11-08", ["published", "swapped"]],
            ])
            expect(env.staff.get("staff-2")).toEqual(person("staff-2", "Bob"))
        })

        it("uses the fixed clock's week when the shift does not exist", async () => {
            const { service, data, setup } = await build(mockEntityManager())
            data.shiftRow.mockResolvedValue(undefined)

            await expect(
                service.checkSwap("ws-1", { kind: "claim", fromStaffId: null, toStaffId: "staff-1" }, "missing"),
            ).resolves.toEqual({
                shift: undefined,
                setup,
                findings: [{ code: "shift-missing", params: {} }],
            })

            expect(data.loadEnv.mock.calls).toEqual([["ws-1", "2026-10-12", setup]])
            expect(data.staffShifts.mock.calls).toEqual([
                ["ws-1", "staff-1", "2026-10-12", "2026-10-18", ["published", "swapped"]],
            ])
        })
    })

    describe("requestLeave", () => {
        it("records the original reason and asks with the trimmed reason and affected shift count", async () => {
            const em = mockEntityManager({
                query: [
                    [CREATE_LEAVE, [{ id: "leave-1" }]],
                    [LINK_LEAVE, []],
                ],
            })
            const { service, data, gate, members, words } = await build(em)
            data.staffShifts.mockResolvedValue([shift, { ...shift, id: "shift-2" }])

            await expect(
                service.requestLeave("user-1", "ws-1", { from: "2026-10-15", to: "2026-10-17", reason: "  Travel  " }),
            ).resolves.toEqual({ status: "waiting_decision" })

            expect(members.require.mock.calls).toEqual([["user-1", "ws-1", []]])
            expect(data.profileOf.mock.calls).toEqual([["ws-1", "user-1"]])
            expect(data.staffShifts.mock.calls).toEqual([
                ["ws-1", "staff-1", "2026-10-15", "2026-10-17", ["draft", "published", "swapped"]],
            ])
            expect(words.range.mock.calls).toEqual([["2026-10-15", "2026-10-17"]])
            expect(gate.request.mock.calls).toEqual([
                [
                    {
                        workspaceId: "ws-1",
                        actor: "Alice",
                        action: "approve_leave",
                        subjectType: "shift_leave",
                        subjectId: "leave-1",
                        dedupeKey: "approve_leave:leave-1",
                        summary: text("shifts.leaveAskSummary", {
                            name: "Alice",
                            range: "leave range",
                            reason: text("shifts.leaveReason", { reason: "Travel" }),
                            count: 2,
                        }),
                        fields: { leave_id: "leave-1" },
                    },
                ],
            ])
            expect(em.query.mock.calls).toEqual([
                [CREATE_LEAVE, ["ws-1", "staff-1", "2026-10-15", "2026-10-17", "  Travel  "]],
                [LINK_LEAVE, ["ws-1", "leave-1", "work-1"]],
            ])
        })

        it("omits a blank reason and links a request even when insert returned no id", async () => {
            const em = mockEntityManager({
                query: [
                    [CREATE_LEAVE, []],
                    [LINK_LEAVE, []],
                ],
            })
            const { service, gate, catalog } = await build(em)
            gate.request.mockResolvedValue({ status: "done", workItemId: "work-2" })

            await expect(
                service.requestLeave("user-1", "ws-1", { from: "2026-10-15", to: "2026-10-15", reason: "  " }),
            ).resolves.toEqual({ status: "done" })

            expect(gate.request.mock.calls).toEqual([
                [
                    {
                        workspaceId: "ws-1",
                        actor: "Alice",
                        action: "approve_leave",
                        subjectType: "shift_leave",
                        subjectId: "",
                        dedupeKey: "approve_leave:",
                        summary: text("shifts.leaveAskSummary", {
                            name: "Alice",
                            range: "leave range",
                            reason: "",
                            count: 0,
                        }),
                        fields: { leave_id: "" },
                    },
                ],
            ])
            expect(catalog.get.mock.calls).toEqual([
                ["shifts.leaveAskSummary", { name: "Alice", range: "leave range", reason: "", count: 0 }, "vi"],
            ])
            expect(em.query.mock.calls).toEqual([
                [CREATE_LEAVE, ["ws-1", "staff-1", "2026-10-15", "2026-10-15", "  "]],
                [LINK_LEAVE, ["ws-1", "", "work-2"]],
            ])
        })

        it.each([
            { from: "invalid", to: "2026-10-17" },
            { from: "2026-10-15", to: "invalid" },
            { from: "2026-10-17", to: "2026-10-15" },
        ])("refuses the invalid leave range $from through $to", async (range) => {
            const em = mockEntityManager()
            const { service, data, gate } = await build(em)

            await expect(service.requestLeave("user-1", "ws-1", { ...range, reason: "" })).rejects.toMatchObject({
                code: ShiftsErrorCode.LeaveRangeInvalid,
            })

            expect(data.staffShifts).not.toHaveBeenCalled()
            expect(gate.request).not.toHaveBeenCalled()
            expect(em.query).not.toHaveBeenCalled()
        })
    })
})
