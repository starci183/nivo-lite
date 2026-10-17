import { Test } from "@nestjs/testing"
import type { MonthSummary } from "../shifts.contracts"
import { monthCsvOf, monthLabel, monthSummaryOf, payrollMarker } from "./month-summary.policy"
import type { AlertShift } from "./shift-alerts.policy"

const SUBJECT = Symbol("month-summary.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { monthCsvOf, monthLabel, monthSummaryOf, payrollMarker } }],
    }).compile()
    return moduleRef.get<typeof import("./month-summary.policy")>(SUBJECT)
}

const person = (id: string, name: string, wage: number) => ({ id, name, wage })

const item = (staffId: string, start: string, end: string, checkedIn: boolean): AlertShift => ({
    shift: {
        id: `${staffId}-${start}`,
        date: "2026-09-03",
        start,
        end,
        positionId: "pos",
        staffId,
        status: "published",
    },
    checkedIn,
    reminded: false,
    alerted: false,
})

describe("monthSummaryOf", () => {
    it("sums scheduled hours times wage per person who worked, with the checked-in hours apart", async () => {
        const subject = await build()

        const setup = { staff: [person("a", "Lan", 30000), person("b", "Minh", 25000), person("c", "Idle", 20000)] }

        expect(
            subject.monthSummaryOf(setup, [
                item("a", "08:00", "12:00", true),
                item("a", "13:00", "15:30", false),
                item("b", "08:00", "10:00", false),
            ]),
        ).toEqual({
            rows: [
                { name: "Lan", shifts: 2, hours: 6.5, checked: 4, wage: 30000, cost: 195000 },
                { name: "Minh", shifts: 1, hours: 2, checked: 0, wage: 25000, cost: 50000 },
            ],
            total: 245000,
            hours: 8.5,
        })
    })
})

describe("monthCsvOf", () => {
    it("writes a header, one quoted line per person and the total", async () => {
        const subject = await build()

        const summary: MonthSummary = {
            rows: [{ name: 'Lan "A"', shifts: 1, hours: 4, checked: 4, wage: 30000, cost: 120000 }],
            total: 120000,
            hours: 4,
        }

        expect(subject.monthCsvOf(summary, "H", "Total").split("\n")).toEqual([
            "H",
            '"Lan ""A""","1","4","4","30000","120000"',
            '"Total","","4","","","120000"',
        ])
    })
})

describe("labels", () => {
    it("names the month and marks its close", async () => {
        const subject = await build()

        expect(subject.monthLabel("2026-09")).toBe("09/2026")
        expect(subject.payrollMarker("2026-09")).toBe("[payroll:2026-09]")
    })
})
