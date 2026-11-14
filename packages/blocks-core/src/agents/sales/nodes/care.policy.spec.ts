import {
    CARE_KINDS,
    afterMinutes,
    dayAfter,
    deliveryCheckAtOf,
    deliveryDayOf,
    isDue,
    nextOccurrenceOf,
    nextYearsWriteAtOf,
    occasionStandingOf,
    paymentStateOf,
    schedulable,
    vietnamDayOf,
} from "./care.policy"

const NOW = "2026-11-09T03:00:00.000Z"

describe("the moment of a care step", () => {
    it("names the four steps a care timer wakes, and nothing else", () => {
        expect(CARE_KINDS).toEqual(["payment-reminder", "payment-stale", "delivery-check", "occasion"])
    })

    it("accepts a moment up to 90 days ahead, and refuses a mistake", () => {
        expect(schedulable(afterMinutes(NOW, 120), NOW)).toBe(true)
        expect(schedulable(afterMinutes(NOW, 91 * 24 * 60), NOW)).toBe(false)
        expect(schedulable("later", NOW)).toBe(false)
    })

    it("counts a moment as come two minutes early, because the clock is a minute sweep", () => {
        expect(isDue(null, NOW)).toBe(true)
        expect(isDue(afterMinutes(NOW, 1), NOW)).toBe(true)
        expect(isDue(afterMinutes(NOW, 60), NOW)).toBe(false)
    })

    it("adds a day, and reads the Vietnam calendar day of an instant", () => {
        expect(dayAfter(NOW)).toBe("2026-11-10T03:00:00.000Z")
        expect(vietnamDayOf("2026-11-19T17:00:00.000Z")).toBe("2026-11-20")
    })
})

describe("the payment of an order", () => {
    it("reads the status of the order: paid, closed for good, or open", () => {
        expect(paymentStateOf("paid")).toBe("paid")
        expect(paymentStateOf("cancelled")).toBe("closed")
        expect(paymentStateOf("failed_system")).toBe("closed")
        expect(paymentStateOf(null)).toBe("closed")
        expect(paymentStateOf("confirmed")).toBe("open")
    })
})

describe("the dates a customer mentioned", () => {
    const birthday = { month: 11, day: 20, year: null }

    it("falls on the next such day in Vietnam time, this year or next", () => {
        expect(nextOccurrenceOf(birthday, NOW)?.toISOString()).toBe("2026-11-19T17:00:00.000Z")
        expect(nextOccurrenceOf({ ...birthday, month: 1, day: 5 }, NOW)?.toISOString()).toBe("2027-01-04T17:00:00.000Z")
    })

    it("lets a one-off date pass for good", () => {
        expect(nextOccurrenceOf({ ...birthday, year: 2026, month: 3 }, NOW)).toBeNull()
        expect(nextOccurrenceOf({ ...birthday, year: 2027, month: 3, day: 1 }, NOW)?.toISOString()).toBe(
            "2027-02-28T17:00:00.000Z",
        )
    })

    it("stands later until the lead time, due inside it, gone when it cannot come again", () => {
        expect(occasionStandingOf(birthday, NOW, 7)).toEqual({
            kind: "later",
            writeAt: "2026-11-12T17:00:00.000Z",
            on: "2026-11-19T17:00:00.000Z",
        })
        expect(occasionStandingOf(birthday, NOW, 14)).toEqual({ kind: "due", on: "2026-11-19T17:00:00.000Z" })
        expect(occasionStandingOf({ ...birthday, year: 2020 }, NOW, 7)).toEqual({ kind: "gone" })
    })

    it("arms next year's write a lead time before the following occurrence, and none for a one-off", () => {
        expect(nextYearsWriteAtOf(birthday, "2026-11-19T17:00:00.000Z", 7)).toBe("2027-11-12T17:00:00.000Z")
        expect(nextYearsWriteAtOf({ ...birthday, year: 2026 }, "2026-11-19T17:00:00.000Z", 7)).toBeNull()
    })
})

describe("the check-in after delivery", () => {
    it("believes a day close to today, and not a guess far away or a malformed one", () => {
        expect(deliveryDayOf("2026-11-10", NOW)).toBe("2026-11-10")
        expect(deliveryDayOf("2026-11-08", NOW)).toBe("2026-11-08")
        expect(deliveryDayOf("2025-01-01", NOW)).toBeNull()
        expect(deliveryDayOf("2027-12-31", NOW)).toBeNull()
        expect(deliveryDayOf("tomorrow", NOW)).toBeNull()
        expect(deliveryDayOf(null, NOW)).toBeNull()
    })

    it("asks the morning after the delivery day", () => {
        expect(deliveryCheckAtOf("2026-11-10")).toBe("2026-11-11T02:00:00.000Z")
    })
})
