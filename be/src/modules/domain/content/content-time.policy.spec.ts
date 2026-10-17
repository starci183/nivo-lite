import { Test } from "@nestjs/testing"
import {
    dayWindow,
    hhmm,
    isReminderDue,
    isSummaryDue,
    lastWeekWindow,
    pad2,
    vnDateKey,
    vnParts,
    vnToIso,
    weekStartKey,
} from "./content-time.policy"

const SUBJECT = Symbol("content-time.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    vnParts,
                    vnToIso,
                    pad2,
                    vnDateKey,
                    weekStartKey,
                    hhmm,
                    dayWindow,
                    lastWeekWindow,
                    isReminderDue,
                    isSummaryDue,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./content-time.policy")>(SUBJECT)
}

/** Monday 12 October 2026, 09:30 in Vietnam. */
const MONDAY = new Date("2026-10-12T02:30:00.000Z")

describe("vnParts", () => {
    it("shifts an instant into Vietnam time", async () => {
        const subject = await buildSubject()

        expect(subject.vnParts(new Date("2026-10-11T18:05:00.000Z"))).toEqual({
            y: 2026,
            m: 10,
            day: 12,
            h: 1,
            min: 5,
            dow: 1,
        })
    })
})

describe("vnToIso", () => {
    it("turns a Vietnam wall-clock time into its instant", async () => {
        const subject = await buildSubject()

        expect(subject.vnToIso(2026, 10, 12, 9, 30)).toBe("2026-10-12T02:30:00.000Z")
        expect(subject.vnToIso(2026, 10, 12)).toBe("2026-10-11T17:00:00.000Z")
    })
})

describe("pad2 and hhmm", () => {
    it("pads to two digits and reads hours and minutes in Vietnam time", async () => {
        const subject = await buildSubject()

        expect(subject.pad2(7)).toBe("07")
        expect(subject.hhmm("2026-10-12T02:05:00.000Z")).toBe("09:05")
    })
})

describe("vnDateKey and weekStartKey", () => {
    it("names the Vietnam date and the Monday of its week", async () => {
        const subject = await buildSubject()

        const sunday = new Date("2026-10-18T16:30:00.000Z")

        expect(subject.vnDateKey(MONDAY)).toBe("2026-10-12")
        expect(subject.weekStartKey(MONDAY)).toBe("2026-10-12")
        expect(subject.vnDateKey(sunday)).toBe("2026-10-18")
        expect(subject.weekStartKey(sunday)).toBe("2026-10-12")
        expect(subject.weekStartKey(new Date("2026-10-18T17:30:00.000Z"))).toBe("2026-10-19")
    })
})

describe("dayWindow and lastWeekWindow", () => {
    it("spans the Vietnam day and the week before the current one", async () => {
        const subject = await buildSubject()

        expect(subject.dayWindow(MONDAY)).toEqual({ from: "2026-10-11T17:00:00.000Z", to: "2026-10-12T17:00:00.000Z" })
        expect(subject.lastWeekWindow(MONDAY)).toEqual({
            from: "2026-10-04T17:00:00.000Z",
            to: "2026-10-11T17:00:00.000Z",
        })
    })
})

describe("isReminderDue", () => {
    it("is due from 07:00 until it was sent today", async () => {
        const subject = await buildSubject()

        expect(subject.isReminderDue(MONDAY, undefined, false)).toBe(true)
        expect(subject.isReminderDue(MONDAY, "2026-10-11", false)).toBe(true)
        expect(subject.isReminderDue(MONDAY, "2026-10-12", false)).toBe(false)
        expect(subject.isReminderDue(new Date("2026-10-11T23:00:00.000Z"), undefined, false)).toBe(false)
    })

    it("is due when an operator forces it", async () => {
        const subject = await buildSubject()

        expect(subject.isReminderDue(MONDAY, "2026-10-12", true)).toBe(true)
    })
})

describe("isSummaryDue", () => {
    it("is due on Monday from 08:00 until it was sent this week", async () => {
        const subject = await buildSubject()

        expect(subject.isSummaryDue(MONDAY, undefined, false)).toBe(true)
        expect(subject.isSummaryDue(MONDAY, "2026-10-05", false)).toBe(true)
        expect(subject.isSummaryDue(MONDAY, "2026-10-12", false)).toBe(false)
        expect(subject.isSummaryDue(new Date("2026-10-11T23:30:00.000Z"), undefined, false)).toBe(false)
        expect(subject.isSummaryDue(new Date("2026-10-13T03:00:00.000Z"), undefined, false)).toBe(false)
    })

    it("is due when an operator forces it", async () => {
        const subject = await buildSubject()

        expect(subject.isSummaryDue(new Date("2026-10-13T03:00:00.000Z"), "2026-10-12", true)).toBe(true)
    })
})
