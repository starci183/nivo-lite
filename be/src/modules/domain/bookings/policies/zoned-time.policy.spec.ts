import { Test } from "@nestjs/testing"
import {
    addDays,
    hhmmOf,
    bookingIsoOf,
    isoWeekday,
    localDate,
    localHhmm,
    mondayOf,
    zoneOffsetMin,
    zonedMs,
} from "./zoned-time.policy"
const SUBJECT = Symbol("zoned-time.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    zoneOffsetMin,
                    zonedMs,
                    localDate,
                    localHhmm,
                    isoWeekday,
                    addDays,
                    mondayOf,
                    hhmmOf,
                    bookingIsoOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./zoned-time.policy")>(SUBJECT)
}

const HCM = "Asia/Ho_Chi_Minh"
const NEW_YORK = "America/New_York"

describe("zoned-time.policy", () => {
    describe("zoneOffsetMin", () => {
        it("is a fixed seven hours for Ho Chi Minh City", async () => {
            const subject = await build()

            expect(subject.zoneOffsetMin(Date.UTC(2026, 0, 1), HCM)).toBe(420)
            expect(subject.zoneOffsetMin(Date.UTC(2026, 6, 1), HCM)).toBe(420)
        })

        it("follows the clock change of a zone with daylight saving time", async () => {
            const subject = await build()

            expect(subject.zoneOffsetMin(Date.UTC(2026, 0, 15, 12), NEW_YORK)).toBe(-300)
            expect(subject.zoneOffsetMin(Date.UTC(2026, 6, 15, 12), NEW_YORK)).toBe(-240)
        })
    })

    describe("zonedMs", () => {
        it("turns a wall-clock reading into its instant", async () => {
            const subject = await build()

            expect(subject.zonedMs("2026-10-08", "09:30", HCM)).toBe(Date.UTC(2026, 9, 8, 2, 30))
            expect(subject.zonedMs("2026-07-01", "12:00", NEW_YORK)).toBe(Date.UTC(2026, 6, 1, 16, 0))
        })

        it("settles midnight on the previous UTC day for a zone ahead of UTC", async () => {
            const subject = await build()

            expect(subject.zonedMs("2026-10-08", "00:00", HCM)).toBe(Date.UTC(2026, 9, 7, 17, 0))
        })
    })

    describe("localDate and localHhmm", () => {
        it("read an instant on the wall clock of the zone", async () => {
            const subject = await build()

            const ms = Date.UTC(2026, 9, 8, 17, 5)
            expect(subject.localDate(ms, HCM)).toBe("2026-10-09")
            expect(subject.localHhmm(ms, HCM)).toBe("00:05")
            expect(subject.localDate(ms, NEW_YORK)).toBe("2026-10-08")
            expect(subject.localHhmm(ms, NEW_YORK)).toBe("13:05")
        })
    })

    describe("isoWeekday", () => {
        it("numbers Monday 1 and Sunday 7", async () => {
            const subject = await build()

            expect(subject.isoWeekday("2026-10-12")).toBe(1)
            expect(subject.isoWeekday("2026-10-14")).toBe(3)
            expect(subject.isoWeekday("2026-10-11")).toBe(7)
        })
    })

    describe("addDays and mondayOf", () => {
        it("moves across month and year ends in both directions", async () => {
            const subject = await build()

            expect(subject.addDays("2026-10-31", 1)).toBe("2026-11-01")
            expect(subject.addDays("2026-01-01", -1)).toBe("2025-12-31")
            expect(subject.addDays("2026-10-12", 0)).toBe("2026-10-12")
        })

        it("finds the Monday of the week of any day", async () => {
            const subject = await build()

            expect(subject.mondayOf("2026-10-12")).toBe("2026-10-12")
            expect(subject.mondayOf("2026-10-14")).toBe("2026-10-12")
            expect(subject.mondayOf("2026-10-11")).toBe("2026-10-05")
        })
    })
})

describe("zoned-time.policy", () => {
    describe("hhmmOf", () => {
        it("keeps hours and minutes of a database time", async () => {
            const subject = await build()

            expect(subject.hhmmOf("09:30:00")).toBe("09:30")
            expect(subject.hhmmOf("18:00")).toBe("18:00")
        })
    })

    describe("bookingIsoOf", () => {
        it("writes an instant in ISO 8601", async () => {
            const subject = await build()

            expect(subject.bookingIsoOf(Date.UTC(2026, 9, 12, 2, 30))).toBe("2026-10-12T02:30:00.000Z")
        })
    })
})
