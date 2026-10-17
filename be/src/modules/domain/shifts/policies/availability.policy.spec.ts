import { Test } from "@nestjs/testing"
import type { Avail } from "../shifts.contracts"
import { isAvailable, onLeave } from "./availability.policy"

const SUBJECT = Symbol("availability.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { isAvailable, onLeave } }],
    }).compile()
    return moduleRef.get<typeof import("./availability.policy")>(SUBJECT)
}

const weekly = (staffId: string, weekday: number, start: string, end: string, available: boolean): Avail => ({
    staffId,
    weekday,
    date: null,
    start,
    end,
    available,
})

const oneDay = (staffId: string, date: string, start: string, end: string, available: boolean): Avail => ({
    staffId,
    weekday: null,
    date,
    start,
    end,
    available,
})

const MONDAY = "2026-10-12"

describe("isAvailable", () => {
    it("is free when the person said nothing, and statements of others do not count", async () => {
        const subject = await build()

        expect(subject.isAvailable([], "a", MONDAY, 420, 720)).toBe(true)
        expect(subject.isAvailable([weekly("b", 0, "00:00", "23:59", false)], "a", MONDAY, 420, 720)).toBe(true)
    })

    it("is blocked when a window the person cannot work overlaps the piece", async () => {
        const subject = await build()

        const avail = [weekly("a", 0, "08:00", "10:00", false)]
        expect(subject.isAvailable(avail, "a", MONDAY, 420, 540)).toBe(false)
        expect(subject.isAvailable(avail, "a", MONDAY, 600, 720)).toBe(true)
        expect(subject.isAvailable(avail, "a", "2026-10-13", 420, 540)).toBe(true)
    })

    it("needs the piece to fit inside the windows the person can work, touching windows merged", async () => {
        const subject = await build()

        const avail = [weekly("a", 0, "12:00", "18:00", true), weekly("a", 0, "07:00", "12:00", true)]
        expect(subject.isAvailable(avail, "a", MONDAY, 420, 1080)).toBe(true)
        expect(subject.isAvailable(avail, "a", MONDAY, 400, 1080)).toBe(false)
        expect(subject.isAvailable(avail, "a", MONDAY, 900, 1200)).toBe(false)
    })

    it("keeps separate windows apart and merges nested ones", async () => {
        const subject = await build()

        const avail = [
            weekly("a", 0, "07:00", "10:00", true),
            weekly("a", 0, "08:00", "09:00", true),
            weekly("a", 0, "14:00", "18:00", true),
        ]
        expect(subject.isAvailable(avail, "a", MONDAY, 420, 600)).toBe(true)
        expect(subject.isAvailable(avail, "a", MONDAY, 540, 900)).toBe(false)
        expect(subject.isAvailable(avail, "a", MONDAY, 840, 1000)).toBe(true)
    })

    it("lets a date statement replace the recurring ones for that day", async () => {
        const subject = await build()

        const avail = [weekly("a", 0, "07:00", "09:00", true), oneDay("a", MONDAY, "12:00", "20:00", true)]
        expect(subject.isAvailable(avail, "a", MONDAY, 780, 1100)).toBe(true)
        expect(subject.isAvailable(avail, "a", MONDAY, 420, 540)).toBe(false)
    })
})

describe("onLeave", () => {
    const leaves = [{ staffId: "a", from: "2026-10-12", to: "2026-10-14" }]

    it("covers the first day, the last day and the days between", async () => {
        const subject = await build()

        expect(subject.onLeave(leaves, "a", "2026-10-12")).toBe(true)
        expect(subject.onLeave(leaves, "a", "2026-10-13")).toBe(true)
        expect(subject.onLeave(leaves, "a", "2026-10-14")).toBe(true)
    })

    it("does not cover other days or other people", async () => {
        const subject = await build()

        expect(subject.onLeave(leaves, "a", "2026-10-15")).toBe(false)
        expect(subject.onLeave(leaves, "a", "2026-10-11")).toBe(false)
        expect(subject.onLeave(leaves, "b", "2026-10-13")).toBe(false)
    })
})
