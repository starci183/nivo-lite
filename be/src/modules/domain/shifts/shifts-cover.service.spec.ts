import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { MessageCatalog } from "@modules/platform/i18n"
import type { ShiftsShiftRow } from "./persistence/shifts.rows"
import { ShiftsCoverService } from "./shifts-cover.service"
import { ShiftsDataService } from "./shifts-data.service"
import { ShiftsTextService } from "./shifts-text.service"
import type { Env, Setup, Shift, ShiftStaff } from "./shifts.contracts"

const text = (key: string, params: Record<string, string | number> = {}): string => `${key}${JSON.stringify(params)}`

const person = (id: string, name: string, overrides: Partial<ShiftStaff> = {}): ShiftStaff => ({
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
    ...overrides,
})

const rowOf = (id: string, overrides: Partial<ShiftsShiftRow> = {}): ShiftsShiftRow => ({
    id,
    schedule_id: "schedule-1",
    shift_date: "2026-10-15",
    start_time: "09:00:00",
    end_time: "13:00:00",
    position_id: "position-1",
    staff_id: "leaver",
    status: "published",
    schedule_status: "published",
    week_start: "2026-10-12",
    ...overrides,
})

const shiftOf = (id: string): Shift => ({
    id,
    date: "2026-10-15",
    start: "09:00",
    end: "13:00",
    positionId: "position-1",
    staffId: null,
    status: "published",
})

const build = async (staff: ReadonlyArray<ShiftStaff> = []) => {
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => text(key, params))
    const words = mock<ShiftsTextService>()
    words.text.mockImplementation((key, params) => catalog.get(key, params ?? {}, "vi"))
    words.line.mockImplementation((_setup, shift) => `${shift.id} line`)
    const setup: Setup = {
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
    }
    const env: Env = {
        staff: new Map(staff.map((item) => [item.id, item])),
        avail: [],
        leaves: [],
        overtimeHoursWeek: 48,
    }
    const data = mock<ShiftsDataService>()
    data.loadSetup.mockResolvedValue(setup)
    data.shiftRow.mockImplementation((_workspaceId, id) => Promise.resolve(rowOf(id)))
    data.loadEnv.mockResolvedValue(env)
    data.rangeShifts.mockResolvedValue([])
    const moduleRef = await Test.createTestingModule({
        providers: [
            ShiftsCoverService,
            { provide: ShiftsDataService, useValue: data },
            { provide: ShiftsTextService, useValue: words },
        ],
    }).compile()
    return { service: moduleRef.get(ShiftsCoverService), data, words, catalog, setup }
}

describe("ShiftsCoverService", () => {
    describe("suggestions", () => {
        it("asks for at most three qualified available names and excludes the person on leave", async () => {
            const { service, data, words, setup } = await build([
                person("leaver", "Leaver"),
                person("inactive", "Inactive", { active: false }),
                person("unqualified", "Unqualified", { positionIds: [] }),
                person("busy", "Busy"),
                person("a", "Alice"),
                person("b", "Bob"),
                person("c", "Chris"),
                person("d", "Dana"),
            ])
            data.rangeShifts.mockResolvedValue([{ ...shiftOf("busy-shift"), staffId: "busy" }])

            await expect(service.suggestions("ws-1", ["shift-1"], "leaver")).resolves.toEqual([
                text("shifts.leaveGapAsk", { line: "shift-1 line", names: "Alice, Bob, Chris" }),
            ])

            expect(data.loadSetup.mock.calls).toEqual([["ws-1", false]])
            expect(data.shiftRow.mock.calls).toEqual([["ws-1", "shift-1"]])
            expect(data.loadEnv.mock.calls).toEqual([["ws-1", "2026-10-12", setup]])
            expect(data.rangeShifts.mock.calls).toEqual([
                ["ws-1", "2026-10-12", "2026-10-18", ["draft", "published", "swapped"]],
            ])
            expect(words.line.mock.calls).toEqual([[setup, shiftOf("shift-1")]])
            expect(words.text.mock.calls).toEqual([
                ["shifts.leaveGapAsk", { line: "shift-1 line", names: "Alice, Bob, Chris" }],
            ])
        })

        it("reports nobody for an uncovered shift", async () => {
            const { service, words, setup } = await build([person("leaver", "Leaver")])

            await expect(service.suggestions("ws-1", ["shift-1"], "leaver")).resolves.toEqual([
                text("shifts.leaveGapNobody", { line: "shift-1 line" }),
            ])

            expect(words.line.mock.calls).toEqual([[setup, shiftOf("shift-1")]])
            expect(words.text.mock.calls).toEqual([["shifts.leaveGapNobody", { line: "shift-1 line" }]])
        })

        it("reads only the first six ids and skips missing rows while preserving order", async () => {
            const { service, data, words, setup } = await build([person("a", "Alice")])
            data.shiftRow.mockResolvedValueOnce(undefined)

            await expect(
                service.suggestions(
                    "ws-1",
                    ["missing", "shift-2", "shift-3", "shift-4", "shift-5", "shift-6", "ignored"],
                    "leaver",
                ),
            ).resolves.toEqual([
                text("shifts.leaveGapAsk", { line: "shift-2 line", names: "Alice" }),
                text("shifts.leaveGapAsk", { line: "shift-3 line", names: "Alice" }),
                text("shifts.leaveGapAsk", { line: "shift-4 line", names: "Alice" }),
                text("shifts.leaveGapAsk", { line: "shift-5 line", names: "Alice" }),
                text("shifts.leaveGapAsk", { line: "shift-6 line", names: "Alice" }),
            ])

            expect(data.shiftRow.mock.calls).toEqual([
                ["ws-1", "missing"],
                ["ws-1", "shift-2"],
                ["ws-1", "shift-3"],
                ["ws-1", "shift-4"],
                ["ws-1", "shift-5"],
                ["ws-1", "shift-6"],
            ])
            expect(words.line.mock.calls).toEqual([
                [setup, shiftOf("shift-2")],
                [setup, shiftOf("shift-3")],
                [setup, shiftOf("shift-4")],
                [setup, shiftOf("shift-5")],
                [setup, shiftOf("shift-6")],
            ])
        })

        it("returns no suggestions when there are no shift ids", async () => {
            const { service, data, words } = await build()

            await expect(service.suggestions("ws-1", [], "leaver")).resolves.toEqual([])

            expect(data.loadSetup.mock.calls).toEqual([["ws-1", false]])
            expect(data.shiftRow).not.toHaveBeenCalled()
            expect(data.loadEnv).not.toHaveBeenCalled()
            expect(data.rangeShifts).not.toHaveBeenCalled()
            expect(words.line).not.toHaveBeenCalled()
            expect(words.text).not.toHaveBeenCalled()
        })
    })
})
