import { Test } from "@nestjs/testing"
import { withinPeriod, offeredTimes, addDayIso } from "./booking-chat.policy"

const SUBJECT = Symbol("booking-chat.policy")
type Subject = {
    withinPeriod: typeof withinPeriod
    offeredTimes: typeof offeredTimes
    addDayIso: typeof addDayIso
}

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { withinPeriod, offeredTimes, addDayIso },
            },
        ],
    }).compile()
    const subject = moduleRef.get<Subject>(SUBJECT)
    return { subject }
}

describe("withinPeriod", () => {
    it("accepts any time when neither end is supplied", async () => {
        const { subject } = await buildSubject()

        expect(subject.withinPeriod("00:00", null, null)).toBe(true)
        expect(subject.withinPeriod("23:59", null, null)).toBe(true)
    })

    it("includes the start of a period and excludes earlier times", async () => {
        const { subject } = await buildSubject()

        expect(subject.withinPeriod("13:00", "13:00", null)).toBe(true)
        expect(subject.withinPeriod("12:59", "13:00", null)).toBe(false)
    })

    it("excludes the end of a period and accepts earlier times", async () => {
        const { subject } = await buildSubject()

        expect(subject.withinPeriod("16:59", null, "17:00")).toBe(true)
        expect(subject.withinPeriod("17:00", null, "17:00")).toBe(false)
        expect(subject.withinPeriod("17:01", null, "17:00")).toBe(false)
    })

    it("requires both bounds when the customer names a closed period", async () => {
        const { subject } = await buildSubject()

        expect(subject.withinPeriod("12:59", "13:00", "17:00")).toBe(false)
        expect(subject.withinPeriod("13:00", "13:00", "17:00")).toBe(true)
        expect(subject.withinPeriod("16:59", "13:00", "17:00")).toBe(true)
        expect(subject.withinPeriod("17:00", "13:00", "17:00")).toBe(false)
    })
})

describe("offeredTimes", () => {
    it("returns no offers for an empty calendar", async () => {
        const { subject } = await buildSubject()

        expect(subject.offeredTimes([], "Asia/Ho_Chi_Minh", 5)).toBe("")
    })

    it("lists distinct local times in input order before applying the cap", async () => {
        const { subject } = await buildSubject()

        expect(
            subject.offeredTimes(
                [
                    "2026-10-13T03:00:00.000Z",
                    "2026-10-13T02:00:00.000Z",
                    "2026-10-13T03:00:30.000Z",
                    "2026-10-14T02:00:00.000Z",
                    "2026-10-13T04:00:00.000Z",
                    "2026-10-13T05:00:00.000Z",
                ],
                "Asia/Ho_Chi_Minh",
                3,
            ),
        ).toBe("10:00, 09:00, 11:00")
    })

    it("uses the requested timezone across the UTC day boundary", async () => {
        const { subject } = await buildSubject()

        expect(subject.offeredTimes(["2026-10-12T18:30:00.000Z"], "Asia/Ho_Chi_Minh", 5)).toBe("01:30")
        expect(subject.offeredTimes(["2026-10-12T18:30:00.000Z"], "America/Los_Angeles", 5)).toBe("11:30")
    })

    it("returns no offers when the cap is zero", async () => {
        const { subject } = await buildSubject()

        expect(subject.offeredTimes(["2026-10-13T02:00:00.000Z"], "Asia/Ho_Chi_Minh", 0)).toBe("")
    })
})

describe("addDayIso", () => {
    it("adds exactly a day and writes the result as a UTC ISO instant", async () => {
        const { subject } = await buildSubject()

        expect(subject.addDayIso("2026-10-13T00:00:00+07:00")).toBe("2026-10-13T17:00:00.000Z")
    })

    it("carries a year boundary without losing the time or milliseconds", async () => {
        const { subject } = await buildSubject()

        expect(subject.addDayIso("2026-12-31T23:45:10.123Z")).toBe("2027-01-01T23:45:10.123Z")
    })

    it("carries a leap day into the next month", async () => {
        const { subject } = await buildSubject()

        expect(subject.addDayIso("2028-02-29T00:00:00.000Z")).toBe("2028-03-01T00:00:00.000Z")
    })
})
