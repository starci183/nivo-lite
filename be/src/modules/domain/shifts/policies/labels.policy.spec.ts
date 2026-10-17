import { Test } from "@nestjs/testing"
import type { ShiftStaff } from "../shifts.contracts"
import { dayLabel, money, nameOf, shiftLine, weekLabel } from "./labels.policy"

const SUBJECT = Symbol("labels.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { dayLabel, money, nameOf, shiftLine, weekLabel } }],
    }).compile()
    return moduleRef.get<typeof import("./labels.policy")>(SUBJECT)
}

const names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

const staff: ShiftStaff = {
    id: "staff-1",
    name: "Alex",
    positionIds: ["position-1"],
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
}

describe("labels policy", () => {
    it("labels a date with its weekday and padded day and month", async () => {
        const subject = await build()

        expect(subject.dayLabel("2026-10-12", names)).toBe("Monday 12/10")
        expect(subject.dayLabel("2026-10-18", names)).toBe("Sunday 18/10")
        expect(subject.dayLabel("2026-10-12", [])).toBe("12/10")
    })

    it("labels a week across the end of a month", async () => {
        const subject = await build()

        expect(subject.weekLabel("2026-10-26", names)).toBe("26/10 - 01/11")
        expect(subject.weekLabel("2026-12-28", [])).toBe("28/12 - 03/01")
    })

    it("includes the known position in a shift line and trims an unknown position", async () => {
        const subject = await build()

        const shift = {
            id: "shift-1",
            date: "2026-10-12",
            start: "07:00",
            end: "11:00",
            positionId: "position-1",
            staffId: "staff-1",
            status: "draft",
        }

        expect(
            subject.shiftLine({ positions: [{ id: "position-1", name: "Barista", color: "#2f6fed" }] }, shift, names),
        ).toBe("Monday 12/10 07:00-11:00 Barista")
        expect(subject.shiftLine({ positions: [] }, shift, [])).toBe("12/10 07:00-11:00")
    })

    it("returns a staff name or a dash for open shifts and unknown staff", async () => {
        const subject = await build()

        expect(subject.nameOf({ staff: [staff] }, "staff-1")).toBe("Alex")
        expect(subject.nameOf({ staff: [staff] }, "staff-2")).toBe("-")
        expect(subject.nameOf({ staff: [staff] }, null)).toBe("-")
    })

    it("rounds money and uses thousands separators and the currency sign", async () => {
        const subject = await build()

        expect(subject.money(30123.6)).toBe("30.124\u0111")
        expect(subject.money(0)).toBe("0\u0111")
        expect(subject.money(-1234.6)).toBe("-1.235\u0111")
    })
})
