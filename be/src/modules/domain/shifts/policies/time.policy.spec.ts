import { Test } from "@nestjs/testing"
import {
    addDays,
    clockVn,
    dayDiff,
    fromMin,
    hhmm,
    instantOf,
    mondayOf,
    monthRange,
    nextMonthStart,
    previousMonth,
    spanMin,
    todayVn,
    toMin,
    weekDates,
    weekdayOf,
} from "./time.policy"

const SUBJECT = Symbol("time.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    addDays,
                    clockVn,
                    dayDiff,
                    fromMin,
                    hhmm,
                    instantOf,
                    mondayOf,
                    monthRange,
                    nextMonthStart,
                    previousMonth,
                    spanMin,
                    todayVn,
                    toMin,
                    weekDates,
                    weekdayOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Omit<typeof import("./time.policy"), "DAY_MIN" | "CELL_MIN">>(SUBJECT)
}

describe("time policy", () => {
    it("reads HH:MM and HH:MM:SS times as minutes and treats other text as midnight", async () => {
        const subject = await build()

        expect(subject.toMin("07:30")).toBe(450)
        expect(subject.toMin("7:05:00")).toBe(425)
        expect(subject.toMin("late")).toBe(0)
    })

    it("writes minutes back as padded HH:MM and normalises database times", async () => {
        const subject = await build()

        expect(subject.fromMin(450)).toBe("07:30")
        expect(subject.fromMin(1440)).toBe("24:00")
        expect(subject.hhmm("07:30:00")).toBe("07:30")
    })

    it("moves days across month and year boundaries", async () => {
        const subject = await build()

        expect(subject.addDays("2026-01-31", 1)).toBe("2026-02-01")
        expect(subject.addDays("2026-01-01", -1)).toBe("2025-12-31")
    })

    it("numbers weekdays from Monday and finds the Monday of a week", async () => {
        const subject = await build()

        expect(subject.weekdayOf("2026-10-12")).toBe(0)
        expect(subject.weekdayOf("2026-10-18")).toBe(6)
        expect(subject.mondayOf("2026-10-16")).toBe("2026-10-12")
        expect(subject.mondayOf("2026-10-12")).toBe("2026-10-12")
    })

    it("lists the seven days of a week", async () => {
        const subject = await build()

        expect(subject.weekDates("2026-10-12")).toEqual([
            "2026-10-12",
            "2026-10-13",
            "2026-10-14",
            "2026-10-15",
            "2026-10-16",
            "2026-10-17",
            "2026-10-18",
        ])
    })

    it("counts whole days between two days", async () => {
        const subject = await build()

        expect(subject.dayDiff("2026-10-12", "2026-10-15")).toBe(3)
        expect(subject.dayDiff("2026-10-15", "2026-10-12")).toBe(-3)
    })

    it("reads the shop wall clock at UTC+7, across midnight", async () => {
        const subject = await build()

        expect(subject.clockVn(new Date("2026-10-12T20:30:00Z"))).toEqual({ date: "2026-10-13", minute: 210 })
        expect(subject.clockVn(new Date("2026-10-12T05:00:00Z"))).toEqual({ date: "2026-10-12", minute: 720 })
        expect(subject.todayVn(new Date("2026-10-12T20:30:00Z"))).toBe("2026-10-13")
    })

    it("finds the UTC instant of a shop-local day and minute", async () => {
        const subject = await build()

        expect(subject.instantOf("2026-10-12", 7 * 60).toISOString()).toBe("2026-10-12T00:00:00.000Z")
        expect(subject.instantOf("2026-10-12", 0).toISOString()).toBe("2026-10-11T17:00:00.000Z")
    })
})

describe("time policy", () => {
    it("finds the bounds of a month, leap years included", async () => {
        const subject = await build()

        expect(subject.monthRange("2026-10")).toEqual({ from: "2026-10-01", to: "2026-10-31" })
        expect(subject.monthRange("2028-02")).toEqual({ from: "2028-02-01", to: "2028-02-29" })
    })

    it("steps to the month before and the first day of the month after", async () => {
        const subject = await build()

        expect(subject.previousMonth("2026-01-15")).toBe("2025-12")
        expect(subject.previousMonth("2026-10-02")).toBe("2026-09")
        expect(subject.nextMonthStart("2026-12-20")).toBe("2027-01-01")
        expect(subject.nextMonthStart("2026-10-31")).toBe("2026-11-01")
    })

    it("measures the span between two times", async () => {
        const subject = await build()

        expect(subject.spanMin("07:00", "11:30")).toBe(270)
    })
})
