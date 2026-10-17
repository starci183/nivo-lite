import { Test } from "@nestjs/testing"
import {
    addDays as addDaysImplementation,
    addHours as addHoursImplementation,
    hiringIsoOf as hiringIsoOfImplementation,
    isoOrNull as isoOrNullImplementation,
    vnClockText as vnClockTextImplementation,
    vnInstant as vnInstantImplementation,
    vnClockParts as vnClockPartsImplementation,
} from "./vn-time.policy"

const SUBJECT = Symbol("subject")
type Subject = {
    addDays: typeof addDaysImplementation
    addHours: typeof addHoursImplementation
    hiringIsoOf: typeof hiringIsoOfImplementation
    isoOrNull: typeof isoOrNullImplementation
    vnClockText: typeof vnClockTextImplementation
    vnInstant: typeof vnInstantImplementation
    vnClockParts: typeof vnClockPartsImplementation
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    addDays: addDaysImplementation,
                    addHours: addHoursImplementation,
                    hiringIsoOf: hiringIsoOfImplementation,
                    isoOrNull: isoOrNullImplementation,
                    vnClockText: vnClockTextImplementation,
                    vnInstant: vnInstantImplementation,
                    vnClockParts: vnClockPartsImplementation,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("hiring Vietnam time policy", () => {
    it("reads calendar parts at the Vietnam date boundary", async () => {
        const subject = await buildSubject()

        expect(subject.vnClockParts(new Date("2026-12-31T17:05:00.000Z"))).toEqual({
            year: 2027,
            month: 0,
            day: 1,
            weekday: 5,
            minute: 5,
        })
        expect(subject.vnClockParts(new Date("2026-10-13T02:30:00.000Z"))).toEqual({
            year: 2026,
            month: 9,
            day: 13,
            weekday: 2,
            minute: 570,
        })
    })

    it("builds instants from local calendar dates and minutes", async () => {
        const subject = await buildSubject()

        expect(subject.vnInstant(2027, 0, 1, 5)).toEqual(new Date("2026-12-31T17:05:00.000Z"))
        expect(subject.vnInstant(2026, 9, 13, 570)).toEqual(new Date("2026-10-13T02:30:00.000Z"))
    })

    it("formats local weekdays, dates and times with two-digit fields", async () => {
        const subject = await buildSubject()

        expect(subject.vnClockText(new Date("2026-12-31T17:05:00.000Z"))).toEqual({
            weekday: 5,
            time: "00:05",
            date: "01/01/2027",
        })
        expect(subject.vnClockText(new Date("2026-10-13T16:59:00.000Z"))).toEqual({
            weekday: 2,
            time: "23:59",
            date: "13/10/2026",
        })
    })

    it("adds signed hours and days without changing the input date", async () => {
        const subject = await buildSubject()

        const from = new Date("2026-10-13T02:30:00.000Z")

        expect(subject.addHours(from, 1.5)).toEqual(new Date("2026-10-13T04:00:00.000Z"))
        expect(subject.addHours(from, -3)).toEqual(new Date("2026-10-12T23:30:00.000Z"))
        expect(subject.addDays(from, 2)).toEqual(new Date("2026-10-15T02:30:00.000Z"))
        expect(from).toEqual(new Date("2026-10-13T02:30:00.000Z"))
    })

    it("converts driver date values to ISO text and preserves null", async () => {
        const subject = await buildSubject()

        expect(subject.hiringIsoOf(new Date("2026-10-13T02:30:00.000Z"))).toBe("2026-10-13T02:30:00.000Z")
        expect(subject.hiringIsoOf("2026-10-13T09:30:00+07:00")).toBe("2026-10-13T02:30:00.000Z")
        expect(subject.isoOrNull(null)).toBeNull()
        expect(subject.isoOrNull("2026-10-13T09:30:00+07:00")).toBe("2026-10-13T02:30:00.000Z")
        expect(subject.isoOrNull(new Date("2026-10-13T02:30:00.000Z"))).toBe("2026-10-13T02:30:00.000Z")
    })
})
