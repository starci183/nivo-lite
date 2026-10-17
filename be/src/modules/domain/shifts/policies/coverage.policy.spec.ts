import { Test } from "@nestjs/testing"
import type { Block, Shift } from "../shifts.contracts"
import { coverageOf, fewestOnDuty } from "./coverage.policy"

const SUBJECT = Symbol("coverage.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { coverageOf, fewestOnDuty } }],
    }).compile()
    return moduleRef.get<typeof import("./coverage.policy")>(SUBJECT)
}

const shift = (values: Partial<Shift> = {}): Shift => ({
    id: "shift-1",
    date: "2026-10-12",
    start: "07:00",
    end: "09:00",
    positionId: "bar",
    staffId: "a",
    status: "draft",
    ...values,
})

const block = (values: Partial<Block> = {}): Block => ({
    id: "block-1",
    weekday: 0,
    start: "07:00",
    end: "09:00",
    positionId: "bar",
    min: 1,
    ideal: 2,
    peak: false,
    ...values,
})

describe("coverage policy", () => {
    it("counts unique people only when they cover every minute of a half-hour cell", async () => {
        const subject = await build()

        const shifts = [
            shift(),
            shift({ id: "duplicate" }),
            shift({ id: "second", staffId: "b", start: "07:30", end: "08:45" }),
            shift({ id: "late", staffId: "c", start: "07:01" }),
            shift({ id: "early-end", staffId: "d", end: "08:40" }),
            shift({ id: "other-date", date: "2026-10-13", staffId: "e" }),
            shift({ id: "other-position", positionId: "cash", staffId: "f" }),
        ]

        expect(subject.fewestOnDuty(shifts, "2026-10-12", "bar", 420, 525)).toBe(2)
        expect(subject.fewestOnDuty(shifts, "2026-10-12", "bar", 450, 525)).toBe(3)
        expect(subject.fewestOnDuty(shifts, "2026-10-12", "bar", 525, 540)).toBe(2)
        expect(subject.fewestOnDuty(shifts, "2026-10-12", "bar", 540, 540)).toBe(0)
        expect(subject.fewestOnDuty([], "2026-10-12", "bar", 420, 540)).toBe(0)
    })
})

describe("coverage policy", () => {
    it("reports exact short, adequate and excess coverage with weekday and fallback dates", async () => {
        const subject = await build()

        expect(
            subject.coverageOf(
                [
                    block({ id: "short", weekday: 1 }),
                    block({ id: "ok", peak: true }),
                    block({ id: "over", ideal: 1 }),
                    block({ id: "fallback", weekday: 9 }),
                ],
                "2026-10-12",
                [
                    shift(),
                    shift({ id: "b", staffId: "b" }),
                    shift({ id: "open", staffId: null }),
                    shift({ id: "cancelled", staffId: "c", status: "cancelled" }),
                ],
            ),
        ).toEqual([
            {
                blockId: "short",
                date: "2026-10-13",
                positionId: "bar",
                start: "07:00",
                end: "09:00",
                min: 1,
                ideal: 2,
                peak: false,
                have: 0,
                status: "short",
            },
            {
                blockId: "ok",
                date: "2026-10-12",
                positionId: "bar",
                start: "07:00",
                end: "09:00",
                min: 1,
                ideal: 2,
                peak: true,
                have: 2,
                status: "ok",
            },
            {
                blockId: "over",
                date: "2026-10-12",
                positionId: "bar",
                start: "07:00",
                end: "09:00",
                min: 1,
                ideal: 1,
                peak: false,
                have: 2,
                status: "over",
            },
            {
                blockId: "fallback",
                date: "2026-10-12",
                positionId: "bar",
                start: "07:00",
                end: "09:00",
                min: 1,
                ideal: 2,
                peak: false,
                have: 2,
                status: "ok",
            },
        ])
        expect(subject.coverageOf([], "2026-10-12", [])).toEqual([])
    })
})
