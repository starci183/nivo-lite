import { Test } from "@nestjs/testing"
import type { Env, Seg, Shift, ShiftStaff } from "../shifts.contracts"
import {
    laborCost,
    liveShifts,
    minutesOf,
    onDate,
    segOf,
    shiftsByStaff,
    violationsForSegs,
    violationsOfShifts,
    weekCost,
} from "./work-rules.policy"

const SUBJECT = Symbol("work-rules.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    laborCost,
                    liveShifts,
                    minutesOf,
                    onDate,
                    segOf,
                    shiftsByStaff,
                    violationsForSegs,
                    violationsOfShifts,
                    weekCost,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./work-rules.policy")>(SUBJECT)
}

const person = (values: Partial<ShiftStaff> = {}): ShiftStaff => ({
    id: "a",
    name: "Alex",
    positionIds: ["bar"],
    skills: [],
    wage: 30000,
    maxWeek: 40,
    maxDay: 8,
    minRest: 11,
    staffRowId: null,
    telegramChatId: null,
    zaloUserId: null,
    phone: null,
    active: true,
    ...values,
})

const envOf = (values: Partial<Env> = {}): Env => ({
    staff: new Map([["a", person()]]),
    avail: [],
    leaves: [],
    overtimeHoursWeek: 40,
    ...values,
})

const segment = (date: string, s: number, e: number, pos = "bar"): Seg => ({ date, s, e, pos })

const shift = (values: Partial<Shift> = {}): Shift => ({
    id: "shift-1",
    date: "2026-10-12",
    start: "07:00",
    end: "11:00",
    positionId: "bar",
    staffId: "a",
    status: "draft",
    ...values,
})

describe("work rules policy", () => {
    it("converts a shift into minutes and keeps only assigned, uncancelled work", async () => {
        const subject = await build()

        const assigned = shift()
        const published = shift({ id: "shift-2", status: "published" })
        const open = shift({ id: "open", staffId: null })
        const cancelled = shift({ id: "cancelled", status: "cancelled" })

        expect(subject.segOf(assigned)).toEqual({ date: "2026-10-12", s: 420, e: 660, pos: "bar" })
        expect(subject.liveShifts([assigned, open, cancelled, published])).toEqual([assigned, published])
        expect(
            subject.shiftsByStaff([assigned, open, cancelled, published, shift({ id: "b-1", staffId: "b" })]),
        ).toEqual(
            new Map([
                ["a", [assigned, published]],
                ["b", [shift({ id: "b-1", staffId: "b" })]],
            ]),
        )
    })

    it("keeps empty violation lists for an unknown person", async () => {
        const subject = await build()

        expect(subject.violationsForSegs(envOf(), "unknown", [segment("2026-10-12", 420, 660)])).toEqual([[]])
        expect(subject.violationsForSegs(envOf(), "a", [])).toEqual([])
    })

    it("keeps violation alignment for several shifts of an unknown person", async () => {
        const subject = await build()

        const unknown = [shift({ staffId: "unknown" }), shift({ id: "unknown-2", staffId: "unknown" })]

        expect(subject.violationsForSegs(envOf(), "unknown", unknown.map(subject.segOf))).toEqual([[], []])
        expect(subject.violationsOfShifts(envOf(), unknown)).toEqual(new Map())
        expect(subject.violationsOfShifts(envOf(), [])).toEqual(new Map())
    })

    it("returns every broken rule in input order with exact cumulative hours", async () => {
        const subject = await build()

        const env = envOf({
            staff: new Map([["a", person({ maxDay: 3, maxWeek: 5 })]]),
            avail: [{ staffId: "a", weekday: 0, date: null, start: "07:00", end: "12:00", available: false }],
            leaves: [{ staffId: "a", from: "2026-10-12", to: "2026-10-12" }],
        })
        const segs = [
            segment("2026-10-13", 300, 420),
            segment("2026-10-12", 480, 720, "cash"),
            segment("2026-10-12", 420, 540),
        ]

        expect(subject.violationsForSegs(env, "a", segs)).toEqual([
            [{ kind: "max_week", detail: "8.0h" }],
            [
                { kind: "position", detail: "position" },
                { kind: "unavailable", detail: "unavailable" },
                { kind: "leave", detail: "leave" },
                { kind: "overlap", detail: "overlap" },
                { kind: "max_day", detail: "6.0h" },
                { kind: "max_week", detail: "6.0h" },
            ],
            [
                { kind: "unavailable", detail: "unavailable" },
                { kind: "leave", detail: "leave" },
                { kind: "overlap", detail: "overlap" },
            ],
        ])
    })
})

describe("work rules policy", () => {
    it("measures rest against the preceding working day and excludes prior work from totals", async () => {
        const subject = await build()

        const env = envOf({
            prior: new Map([
                [
                    "a",
                    [
                        segment("2026-10-11", 900, 1320),
                        segment("2026-10-10", 420, 1200),
                        segment("2026-10-11", 420, 600),
                        segment("2026-10-09", 420, 600),
                    ],
                ],
            ]),
        })
        const segs = [segment("2026-10-13", 420, 480), segment("2026-10-12", 480, 600), segment("2026-10-12", 360, 420)]

        expect(subject.violationsForSegs(env, "a", segs)).toEqual([
            [],
            [{ kind: "rest", detail: "10.0h" }],
            [{ kind: "rest", detail: "8.0h" }],
        ])
        expect(subject.violationsForSegs(env, "b", segs)).toEqual([[], [], []])
        expect(subject.violationsForSegs(envOf({ prior: new Map() }), "a", [segment("2026-10-12", 420, 480)])).toEqual([
            [],
        ])
    })

    it("tolerates rounding at hour limits and exact rest at the boundary", async () => {
        const subject = await build()

        const env = envOf({ staff: new Map([["a", person({ maxDay: 1, maxWeek: 2, minRest: 23 })]]) })

        expect(
            subject.violationsForSegs(env, "a", [segment("2026-10-12", 420, 480.005), segment("2026-10-13", 481, 541)]),
        ).toEqual([[], []])
        expect(
            subject.violationsForSegs(env, "a", [segment("2026-10-12", 420, 480), segment("2026-10-13", 420, 480)]),
        ).toEqual([[], []])
    })

    it("maps violations only to assigned live shifts with findings", async () => {
        const subject = await build()

        const invalid = shift({ id: "invalid", positionId: "cash" })
        const healthy = shift({ id: "healthy", date: "2026-10-13" })

        expect(
            subject.violationsOfShifts(envOf(), [
                invalid,
                healthy,
                shift({ id: "open", staffId: null }),
                shift({ staffId: "b" }),
            ]),
        ).toEqual(new Map([["invalid", [{ kind: "position", detail: "position" }]]]))
    })
})

describe("work rules policy", () => {
    it("keeps finding order and duplicate shift ids across staff groups", async () => {
        const subject = await build()

        const env = envOf({
            staff: new Map([
                ["a", person({ maxDay: 1, maxWeek: 2, minRest: 0 })],
                ["b", person({ id: "b", minRest: 0 })],
            ]),
        })

        const shifts = [
            shift({ id: "shared", start: "12:00", end: "13:00" }),
            shift({ id: "b-finding", staffId: "b", positionId: "cash", end: "08:00" }),
            shift({ id: "shared", end: "08:00" }),
            shift({ id: "shared", date: "2026-10-13", end: "08:00" }),
            shift({ id: "a-finding", date: "2026-10-13", start: "12:00", end: "13:00", positionId: "cash" }),
            shift({ id: "shared", staffId: "b", date: "2026-10-13", end: "08:00" }),
        ]

        expect([...subject.violationsOfShifts(env, shifts)]).toEqual([
            ["shared", [{ kind: "max_week", detail: "3.0h" }]],
            [
                "a-finding",
                [
                    { kind: "position", detail: "position" },
                    { kind: "max_day", detail: "2.0h" },
                    { kind: "max_week", detail: "4.0h" },
                ],
            ],
            ["b-finding", [{ kind: "position", detail: "position" }]],
        ])
    })

    it("totals minutes and pays overtime at one and a half times the wage", async () => {
        const subject = await build()

        const segs = [segment("2026-10-12", 420, 900), segment("2026-10-13", 420, 900)]

        expect(subject.minutesOf([])).toBe(0)
        expect(subject.minutesOf(segs)).toBe(960)
        expect(subject.weekCost(person(), segs, 10)).toBe(570000)
        expect(subject.weekCost(person({ wage: 1 }), [segment("2026-10-12", 0, 31)], 10)).toBe(1)
        expect(subject.weekCost(person(), [], 40)).toBe(0)
    })

    it("reports exact labor costs while ignoring unknown, open and cancelled people", async () => {
        const subject = await build()

        const env = envOf({
            staff: new Map([
                ["a", person()],
                ["b", person({ id: "b", wage: 40000 })],
            ]),
            overtimeHoursWeek: 3,
        })

        expect(
            subject.laborCost(env, [
                shift(),
                shift({ id: "a-2", date: "2026-10-13" }),
                shift({ id: "b-1", staffId: "b", end: "09:00" }),
                shift({ id: "missing", staffId: "missing" }),
                shift({ id: "open", staffId: null }),
                shift({ id: "cancelled", status: "cancelled" }),
            ]),
        ).toEqual({
            total: 395000,
            byStaff: [
                { staffId: "a", minutes: 480, cost: 315000 },
                { staffId: "b", minutes: 120, cost: 80000 },
            ],
        })
        expect(subject.laborCost(env, [])).toEqual({ total: 0, byStaff: [] })
    })
})

describe("work rules policy", () => {
    it("returns noncancelled shifts on a date in chronological order", async () => {
        const subject = await build()

        const morning = shift()
        const evening = shift({ id: "evening", start: "18:00", end: "20:00", staffId: null })

        expect(
            subject.onDate(
                [evening, shift({ date: "2026-10-13" }), shift({ status: "cancelled" }), morning],
                "2026-10-12",
            ),
        ).toEqual([morning, evening])
        expect(subject.onDate([], "2026-10-12")).toEqual([])
    })
})
