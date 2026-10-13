import type { Env, Setup, Shift, ShiftStaff } from "../shifts.contracts"
import type { SwapCheck } from "./swap-rules.policy"
import { coverCandidates, swapFindings } from "./swap-rules.policy"

const person = (overrides: Partial<ShiftStaff> = {}): ShiftStaff => ({
    id: "staff-1",
    name: "Alex",
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

const target: Shift = {
    id: "shift-1",
    date: "2026-10-12",
    start: "09:00",
    end: "17:00",
    positionId: "position-1",
    staffId: "owner-1",
    status: "published",
}

const setup: Setup = {
    positions: [{ id: "position-1", name: "Cashier", color: "#123456" }],
    staff: [person()],
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

const environment = (staff: ReadonlyArray<ShiftStaff>): Env => ({
    staff: new Map(staff.map((item) => [item.id, item])),
    avail: [],
    leaves: [],
    overtimeHoursWeek: 48,
})

const check = (overrides: Partial<SwapCheck> = {}): SwapCheck => ({
    ask: { kind: "swap", fromStaffId: "owner-1", toStaffId: "staff-1" },
    shift: target,
    setup,
    env: environment(setup.staff),
    mine: [],
    now: new Date("2026-10-10T02:00:00Z"),
    ...overrides,
})

describe("swapFindings", () => {
    it("returns only shift-missing when the shift does not exist", () => {
        expect(swapFindings(check({ shift: undefined }))).toEqual([{ code: "shift-missing", params: {} }])
    })

    it.each(["published", "swapped"])("accepts an owned %s shift with a qualified taker", (status) => {
        expect(swapFindings(check({ shift: { ...target, status } }))).toEqual([])
    })

    it("reports an unposted shift and an offer from someone other than its owner", () => {
        expect(swapFindings(check({ shift: { ...target, staffId: "another-owner", status: "draft" } }))).toEqual([
            { code: "not-posted", params: {} },
            { code: "not-owner", params: {} },
        ])
    })

    it("reports a claim on a taken shift and accepts a claim on an open shift", () => {
        const ask = { kind: "claim", fromStaffId: null, toStaffId: "staff-1" }

        expect(swapFindings(check({ ask: { ...ask, kind: "claim" } }))).toEqual([{ code: "taken", params: {} }])
        expect(swapFindings(check({ ask: { ...ask, kind: "claim" }, shift: { ...target, staffId: null } }))).toEqual([])
    })

    it("retains shift findings when the taker does not exist", () => {
        expect(
            swapFindings(
                check({
                    shift: { ...target, status: "cancelled", staffId: "another-owner" },
                    setup: { ...setup, staff: [] },
                }),
            ),
        ).toEqual([
            { code: "not-posted", params: {} },
            { code: "not-owner", params: {} },
            { code: "taker-gone", params: {} },
        ])
    })

    it("reports an inactive taker before checking notice or work rules", () => {
        expect(
            swapFindings(
                check({
                    setup: { ...setup, staff: [person({ active: false })] },
                    now: new Date("2026-10-13T02:00:00Z"),
                }),
            ),
        ).toEqual([{ code: "taker-gone", params: {} }])
    })

    it("reports a shift that has already started", () => {
        expect(swapFindings(check({ now: new Date("2026-10-12T02:00:00.001Z") }))).toEqual([
            { code: "started", params: {} },
        ])
    })

    it("reports insufficient notice including the exact start instant", () => {
        expect(swapFindings(check({ now: new Date("2026-10-11T02:00:00.001Z") }))).toEqual([
            { code: "notice", params: { hours: 24 } },
        ])
        expect(swapFindings(check({ now: new Date("2026-10-12T02:00:00Z") }))).toEqual([
            { code: "notice", params: { hours: 24 } },
        ])
        expect(swapFindings(check({ now: new Date("2026-10-11T02:00:00Z") }))).toEqual([])
    })

    it("reports the position name and every distinct work rule in discovery order", () => {
        const taker = person({ positionIds: [], maxDay: 2, maxWeek: 3, minRest: 12 })
        const env: Env = {
            ...environment([taker]),
            avail: [{ staffId: "staff-1", weekday: 0, date: null, start: "08:00", end: "18:00", available: false }],
            leaves: [{ staffId: "staff-1", from: "2026-10-12", to: "2026-10-12" }],
        }

        expect(
            swapFindings(
                check({
                    setup: { ...setup, staff: [taker] },
                    env,
                    mine: [
                        {
                            ...target,
                            id: "prior-1",
                            date: "2026-10-11",
                            start: "22:00",
                            end: "23:00",
                            staffId: "staff-1",
                        },
                        { ...target, id: "mine-1", start: "08:00", end: "10:00", staffId: "staff-1" },
                    ],
                }),
            ),
        ).toEqual([
            { code: "position", params: { name: "Alex", position: "Cashier" } },
            { code: "rule-unavailable", params: { name: "Alex" } },
            { code: "rule-leave", params: { name: "Alex" } },
            { code: "rule-overlap", params: { name: "Alex" } },
            { code: "rule-rest", params: { name: "Alex" } },
            { code: "rule-max_day", params: { name: "Alex" } },
            { code: "rule-max_week", params: { name: "Alex" } },
        ])
    })

    it("renders a missing position as empty text and avoids a duplicate position rule", () => {
        expect(swapFindings(check({ shift: { ...target, positionId: "missing-position" } }))).toEqual([
            { code: "position", params: { name: "Alex", position: "" } },
        ])
    })
})

describe("coverCandidates", () => {
    it("keeps qualified active people inside every rule and ignores the target shift itself", () => {
        const available = person()
        const inactive = person({ id: "inactive", active: false })
        const excluded = person({ id: "excluded" })
        const unqualified = person({ id: "unqualified", positionIds: [] })
        const busy = person({ id: "busy" })
        const staff = [available, inactive, excluded, unqualified, busy]
        const assignedTarget = { ...target, staffId: "staff-1" }

        expect(
            coverCandidates(
                { ...setup, staff },
                environment(staff),
                assignedTarget,
                [
                    assignedTarget,
                    { ...target, id: "unrelated", staffId: "someone-else" },
                    { ...target, id: "busy-shift", start: "10:00", end: "11:00", staffId: "busy" },
                    { ...target, id: "next-day", date: "2026-10-13", start: "09:00", end: "10:00", staffId: "staff-1" },
                ],
                ["excluded"],
            ),
        ).toEqual([available])
    })

    it("returns no candidates when every person is unavailable", () => {
        const env: Env = {
            ...environment(setup.staff),
            avail: [{ staffId: "staff-1", weekday: 0, date: null, start: "09:00", end: "17:00", available: false }],
        }

        expect(coverCandidates(setup, env, target, [], [])).toEqual([])
    })
})
