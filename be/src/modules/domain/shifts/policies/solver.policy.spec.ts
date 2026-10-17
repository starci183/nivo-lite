import { Test } from "@nestjs/testing"
import { solveWeek } from "./solver.policy"
import { person, block, inputOf, shift, report } from "@tests/fixtures/builders/solver.builder"
const SUBJECT = Symbol("solver.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { solveWeek } }],
    }).compile()
    return moduleRef.get<typeof import("./solver.policy")>(SUBJECT)
}

describe("schedule solver policy", () => {
    it("creates an exact draft and report with a fixed clock", async () => {
        const subject = await build()

        expect(subject.solveWeek(inputOf())).toEqual({ shifts: [shift()], report: report() })
    })

    it("filters inactive staff and returns an exact empty solution when no blocks exist", async () => {
        const subject = await build()

        expect(subject.solveWeek(inputOf({ staff: [person({ active: false })], blocks: [], starts: 3 }))).toEqual({
            shifts: [],
            report: report({ iterations: 3, costVnd: 0, shiftCount: 0, hoursByStaff: [] }),
        })
    })

    it.each([
        ["07:00", "07:00"],
        ["11:00", "07:00"],
        ["invalid", "invalid"],
    ])("creates no coverage cells for the empty block %s-%s", async (start, end) => {
        const subject = await build()

        expect(subject.solveWeek(inputOf({ blocks: [block({ start, end })], starts: 2 }))).toEqual({
            shifts: [],
            report: report({ iterations: 2, costVnd: 0, shiftCount: 0, hoursByStaff: [] }),
        })
    })

    it("fills busy windows to ideal and breaks equal costs by flexibility then name", async () => {
        const subject = await build()

        const staff = [
            person({ id: "flexible", name: "Aaron", positionIds: ["bar", "cash"] }),
            person({ id: "b", name: "Blake" }),
            person({ id: "a", name: "Alex" }),
            person({ id: "inactive", active: false }),
        ]

        expect(subject.solveWeek(inputOf({ staff, blocks: [block({ ideal: 2, peak: true })] }))).toEqual({
            shifts: [shift(), shift({ id: "new-1", staffId: "b" })],
            report: report({
                costVnd: 240000,
                shiftCount: 2,
                hoursByStaff: [
                    { staffId: "a", hours: 4 },
                    { staffId: "b", hours: 4 },
                ],
            }),
        })
    })

    it("merges touching pieces across a long block and keeps distinct positions and days", async () => {
        const subject = await build()

        const blocks = [
            block({ id: "wide", start: "07:00", end: "19:00" }),
            block({ id: "cash", positionId: "cash", start: "20:00", end: "21:00" }),
            block({ id: "wednesday", weekday: 2 }),
            block({ id: "tuesday", weekday: 1 }),
            block({ id: "touching", start: "19:00", end: "20:00" }),
        ]

        expect(
            subject.solveWeek(
                inputOf({ staff: [person({ positionIds: ["bar", "cash"], maxDay: 16, minRest: 0 })], blocks }),
            ),
        ).toEqual({
            shifts: [
                shift({ end: "20:00" }),
                shift({ id: "new-1", start: "20:00", end: "21:00", positionId: "cash" }),
                shift({ id: "new-2", date: "2026-10-13" }),
                shift({ id: "new-3", date: "2026-10-14" }),
            ],
            report: report({ costVnd: 660000, shiftCount: 4, hoursByStaff: [{ staffId: "a", hours: 22 }] }),
        })
    })
})

describe("schedule solver policy", () => {
    it("repairs a shortage by transferring an earlier piece to another qualified person", async () => {
        const subject = await build()

        const staff = [
            person({ positionIds: ["bar", "cash"], wage: 10000 }),
            person({ id: "b", name: "Blake", wage: 20000 }),
            person({ id: "c", name: "Casey", positionIds: ["cash"], maxDay: 0 }),
        ]
        const blocks = [
            block({ end: "12:00" }),
            block({ id: "cash", start: "12:00", end: "17:00", positionId: "cash" }),
        ]

        expect(subject.solveWeek(inputOf({ staff, blocks }))).toEqual({
            shifts: [
                shift({ start: "12:00", end: "17:00", positionId: "cash" }),
                shift({ id: "new-1", end: "12:00", staffId: "b" }),
            ],
            report: report({
                costVnd: 150000,
                shiftCount: 2,
                hoursByStaff: [
                    { staffId: "a", hours: 5 },
                    { staffId: "b", hours: 5 },
                ],
            }),
        })
    })

    it("reports each actionable shortage reason and excludes leave, unqualified and mixed refusals", async () => {
        const subject = await build()

        const staff = [
            person({ id: "unavailable" }),
            person({ id: "hours", maxDay: 0, maxWeek: 0 }),
            person({ id: "rest" }),
            person({ id: "mixed", maxDay: 0 }),
            person({ id: "leave" }),
            person({ id: "unqualified", positionIds: ["cash"] }),
        ]
        const input = inputOf({
            staff,
            blocks: [block({ min: 2, ideal: 3, peak: true })],
            avail: [
                { staffId: "unavailable", weekday: 0, date: null, start: "00:00", end: "24:00", available: false },
                { staffId: "mixed", weekday: 0, date: null, start: "00:00", end: "24:00", available: false },
            ],
            leaves: [{ staffId: "leave", from: "2026-10-12", to: "2026-10-12" }],
            prior: new Map([["rest", [{ date: "2026-10-11", s: 1200, e: 1380, pos: "bar" }]]]),
        })

        expect(subject.solveWeek(input)).toEqual({
            shifts: [shift({ staffId: null }), shift({ id: "new-1", staffId: null })],
            report: report({
                costVnd: 0,
                shiftCount: 0,
                openCount: 2,
                shortages: [
                    {
                        blockId: "block-1",
                        date: "2026-10-12",
                        positionId: "bar",
                        start: "07:00",
                        end: "11:00",
                        missing: 2,
                    },
                ],
                hoursByStaff: [],
                askCandidates: [
                    { blockId: "block-1", date: "2026-10-12", staffId: "unavailable", why: "unavailable" },
                    { blockId: "block-1", date: "2026-10-12", staffId: "hours", why: "over_hours" },
                    { blockId: "block-1", date: "2026-10-12", staffId: "rest", why: "rest" },
                ],
            }),
        })
    })
})

describe("schedule solver policy", () => {
    it("retains already covered people when another head cannot cover the block", async () => {
        const subject = await build()

        expect(subject.solveWeek(inputOf({ blocks: [block({ min: 2, ideal: 2 })] }))).toEqual({
            shifts: [shift(), shift({ id: "new-1", staffId: null })],
            report: report({
                openCount: 1,
                shortages: [
                    {
                        blockId: "block-1",
                        date: "2026-10-12",
                        positionId: "bar",
                        start: "07:00",
                        end: "11:00",
                        missing: 1,
                    },
                ],
            }),
        })
    })

    it("uses an empty fallback date for an out-of-range weekday and ignores zero-length blocks", async () => {
        const subject = await build()

        expect(
            subject.solveWeek(
                inputOf({ staff: [], blocks: [block({ weekday: 9 }), block({ id: "empty", end: "07:00" })] }),
            ),
        ).toEqual({
            shifts: [shift({ date: "", staffId: null })],
            report: report({
                costVnd: 0,
                shiftCount: 0,
                openCount: 1,
                shortages: [
                    { blockId: "block-1", date: "", positionId: "bar", start: "07:00", end: "11:00", missing: 1 },
                ],
                hoursByStaff: [],
            }),
        })
    })

    it("caps additional starts by a fixed budget and reports elapsed clock time", async () => {
        const subject = await build()

        expect(subject.solveWeek(inputOf({ nowMs: () => 1000, starts: 5, budgetMs: 0 }))).toEqual({
            shifts: [shift()],
            report: report(),
        })
        expect(subject.solveWeek(inputOf({ nowMs: () => 1000, starts: 3 }))).toEqual({
            shifts: [shift()],
            report: report({ iterations: 3 }),
        })
    })

    it("keeps the cheaper deterministic solution when seeded starts perturb tied assignments", async () => {
        const subject = await build()

        expect(
            subject.solveWeek(
                inputOf({
                    staff: [person(), person({ id: "b", name: "Blake", wage: 32000 })],
                    blocks: [block(), block({ id: "tuesday", weekday: 1 })],
                    starts: 4,
                }),
            ),
        ).toEqual({
            shifts: [shift(), shift({ id: "new-1", date: "2026-10-13" })],
            report: report({
                iterations: 4,
                costVnd: 240000,
                shiftCount: 2,
                hoursByStaff: [{ staffId: "a", hours: 8 }],
            }),
        })
    })
})

describe("schedule solver policy", () => {
    it("cannot repair weekly hours when removing one piece still leaves too much work", async () => {
        const subject = await build()

        expect(
            subject.solveWeek(
                inputOf({
                    staff: [person({ maxWeek: 8 })],
                    blocks: [
                        block({ end: "10:00" }),
                        block({ id: "tuesday", weekday: 1, end: "10:00" }),
                        block({ id: "wednesday", weekday: 2, end: "13:00" }),
                    ],
                }),
            ),
        ).toEqual({
            shifts: [
                shift({ end: "10:00" }),
                shift({ id: "new-1", date: "2026-10-13", end: "10:00" }),
                shift({ id: "new-2", date: "2026-10-14", end: "13:00", staffId: null }),
            ],
            report: report({
                costVnd: 180000,
                shiftCount: 2,
                openCount: 1,
                shortages: [
                    {
                        blockId: "wednesday",
                        date: "2026-10-14",
                        positionId: "bar",
                        start: "07:00",
                        end: "13:00",
                        missing: 1,
                    },
                ],
                hoursByStaff: [{ staffId: "a", hours: 6 }],
                askCandidates: [{ blockId: "wednesday", date: "2026-10-14", staffId: "a", why: "over_hours" }],
            }),
        })
    })
})

describe("schedule solver policy", () => {
    it("cannot transfer a conflicting piece to another person who has no day capacity", async () => {
        const subject = await build()

        const staff = [
            person({ positionIds: ["bar", "cash"], wage: 10000 }),
            person({ id: "b", name: "Blake", maxDay: 0 }),
            person({ id: "c", name: "Casey", positionIds: ["cash"], maxDay: 0 }),
        ]

        expect(
            subject.solveWeek(
                inputOf({
                    staff,
                    blocks: [
                        block({ end: "12:00" }),
                        block({ id: "cash", positionId: "cash", start: "12:00", end: "17:00" }),
                    ],
                }),
            ),
        ).toEqual({
            shifts: [
                shift({ end: "12:00" }),
                shift({ id: "new-1", positionId: "cash", start: "12:00", end: "17:00", staffId: null }),
            ],
            report: report({
                costVnd: 50000,
                openCount: 1,
                shortages: [
                    {
                        blockId: "cash",
                        date: "2026-10-12",
                        positionId: "cash",
                        start: "12:00",
                        end: "17:00",
                        missing: 1,
                    },
                ],
                hoursByStaff: [{ staffId: "a", hours: 5 }],
                askCandidates: [
                    { blockId: "cash", date: "2026-10-12", staffId: "a", why: "over_hours" },
                    { blockId: "cash", date: "2026-10-12", staffId: "c", why: "over_hours" },
                ],
            }),
        })
    })

    it("selects a seeded start that reserves the cheaper flexible person for the longer role", async () => {
        const subject = await build()

        const staff = [
            person({ positionIds: ["bar", "cash"], wage: 10000 }),
            person({ id: "b", name: "Blake", wage: 20000 }),
            person({ id: "c", name: "Casey", positionIds: ["cash"], wage: 30000 }),
        ]

        expect(
            subject.solveWeek(
                inputOf({
                    staff,
                    blocks: [block(), block({ id: "cash", start: "11:00", end: "16:00", positionId: "cash" })],
                    starts: 4,
                }),
            ),
        ).toEqual({
            shifts: [shift({ start: "11:00", end: "16:00", positionId: "cash" }), shift({ id: "new-1", staffId: "b" })],
            report: report({
                iterations: 4,
                costVnd: 130000,
                shiftCount: 2,
                hoursByStaff: [
                    { staffId: "a", hours: 5 },
                    { staffId: "b", hours: 4 },
                ],
            }),
        })
    })
})

describe("schedule solver policy", () => {
    it("selects the fairest seeded allocation when total wages are tied", async () => {
        const subject = await build()

        expect(
            subject.solveWeek(
                inputOf({
                    staff: [person({ wage: 0, maxWeek: 8 }), person({ id: "b", name: "Blake", wage: 0, maxWeek: 8 })],
                    blocks: [
                        block({ end: "09:00" }),
                        block({ id: "tuesday", weekday: 1 }),
                        block({ id: "wednesday", weekday: 2, end: "13:00" }),
                    ],
                    starts: 4,
                }),
            ),
        ).toEqual({
            shifts: [
                shift({ date: "2026-10-14", end: "13:00" }),
                shift({ id: "new-1", end: "09:00", staffId: "b" }),
                shift({ id: "new-2", date: "2026-10-13", staffId: "b" }),
            ],
            report: report({
                iterations: 4,
                costVnd: 0,
                shiftCount: 3,
                hoursByStaff: [
                    { staffId: "a", hours: 6 },
                    { staffId: "b", hours: 6 },
                ],
            }),
        })
    })

    it("keeps the complete baseline when extending a person adds no minimum coverage in a seeded start", async () => {
        const subject = await build()

        expect(
            subject.solveWeek(
                inputOf({
                    staff: [person({ wage: 0 }), person({ id: "b", name: "Blake", wage: 0 })],
                    blocks: [
                        block({ id: "first", end: "10:00" }),
                        block({ id: "target", end: "15:00", min: 2, ideal: 2 }),
                        block({ id: "second", start: "10:00", end: "15:00" }),
                    ],
                    starts: 9,
                }),
            ),
        ).toEqual({
            shifts: [shift({ end: "15:00" }), shift({ id: "new-1", end: "15:00", staffId: "b" })],
            report: report({
                iterations: 9,
                costVnd: 0,
                shiftCount: 2,
                hoursByStaff: [
                    { staffId: "a", hours: 8 },
                    { staffId: "b", hours: 8 },
                ],
            }),
        })
    })
})

describe("schedule solver policy", () => {
    it("stops filling at sixty heads and does not ask an available person to waive a rule", async () => {
        const subject = await build()

        const staff = Array.from({ length: 61 }, (_, index) =>
            person({ id: `p-${String(index).padStart(2, "0")}`, name: `Person ${String(index).padStart(2, "0")}` }),
        )
        const assigned = staff.slice(0, 60).map((p, index) => shift({ id: `new-${index}`, staffId: p.id }))

        expect(subject.solveWeek(inputOf({ staff, blocks: [block({ min: 61, ideal: 61 })] }))).toEqual({
            shifts: [...assigned, shift({ id: "new-60", staffId: null })],
            report: report({
                costVnd: 7200000,
                shiftCount: 60,
                openCount: 1,
                shortages: [
                    {
                        blockId: "block-1",
                        date: "2026-10-12",
                        positionId: "bar",
                        start: "07:00",
                        end: "11:00",
                        missing: 1,
                    },
                ],
                hoursByStaff: staff.slice(0, 60).map((p) => ({ staffId: p.id, hours: 4 })),
                askCandidates: [],
            }),
        })
    })
})
