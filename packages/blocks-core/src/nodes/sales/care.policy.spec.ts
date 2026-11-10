import { careSample } from "./care.copy"
import {
    afterMinutes,
    careFactsOf,
    careKindOf,
    careTaskKeyOf,
    careTaskOf,
    careTaskTitleOf,
    deliveryCheckAtOf,
    deliveryDayOf,
    isDue,
    nextOccurrenceOf,
    occasionOfSuffix,
    occasionStandingOf,
    occasionSuffixOf,
    paymentStateOf,
    schedulable,
    shipAttemptOf,
    shipSuffixOf,
} from "./care.policy"

const NOW = new Date("2026-11-09T03:00:00.000Z")

describe("the timer of a care step", () => {
    it("keeps the step, the record, the suffix and the real moment in the key and title of the task", () => {
        const key = careTaskKeyOf("occasion", "lead-1", "birthday-2-1")
        const title = careTaskTitleOf("2027-01-25T17:00:00.000Z")

        expect(key).toBe("care:occasion:lead-1:birthday-2-1")
        expect(careTaskOf(key, title)).toEqual({
            kind: "occasion",
            ref: "lead-1",
            suffix: "birthday-2-1",
            dueAt: "2027-01-25T17:00:00.000Z",
        })
    })

    it("has an empty suffix when the step has none", () => {
        expect(careTaskKeyOf("payment-reminder", "o1", "")).toBe("care:payment-reminder:o1")
        expect(careTaskOf("care:payment-reminder:o1", careTaskTitleOf("2026-11-09T05:00:00.000Z"))?.suffix).toBe("")
    })

    it("tells a task that is not a care step", () => {
        expect(careTaskOf("goal:follow-up", careTaskTitleOf("2026-11-09T05:00:00.000Z"))).toBeNull()
        expect(careTaskOf("care:mystery:o1", careTaskTitleOf("2026-11-09T05:00:00.000Z"))).toBeNull()
        expect(careTaskOf("care:occasion:", careTaskTitleOf("2026-11-09T05:00:00.000Z"))).toBeNull()
        expect(careTaskOf("care:occasion:l1", "a title")).toBeNull()
        expect(careTaskOf("care:occasion:l1", careTaskTitleOf("not a date"))).toBeNull()
    })

    it("names the four steps and nothing else", () => {
        expect(careKindOf("delivery-check")).toBe("delivery-check")
        expect(careKindOf("after-sale")).toBeNull()
        expect(careKindOf(3)).toBeNull()
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

describe("what care reads from the consult facts", () => {
    it("reads the delivery facts, the opt-out and the dates", () => {
        expect(
            careFactsOf({
                recipient: " Mai ",
                deliveryAt: "tomorrow",
                address: "25 Nguyen Hue",
                careOptOut: true,
                occasions: [{ label: "birthday", date: "02-01" }, { label: "wedding", date: "2027-05-20" }],
            }),
        ).toEqual({
            recipient: "Mai",
            deliveryAt: "tomorrow",
            address: "25 Nguyen Hue",
            optedOut: true,
            occasions: [
                { label: "birthday", month: 2, day: 1, year: null },
                { label: "wedding", month: 5, day: 20, year: 2027 },
            ],
        })
    })

    it("counts what cannot be read as not known, and never as an opt-out", () => {
        expect(careFactsOf("nothing")).toEqual({
            recipient: null,
            deliveryAt: null,
            address: null,
            optedOut: false,
            occasions: [],
        })
        expect(careFactsOf({ careOptOut: "yes", occasions: [{ label: "x", date: "13-40" }, 4, { date: "01-01" }] }).optedOut).toBe(
            false,
        )
        expect(careFactsOf({ occasions: [{ label: "x", date: "13-40" }, 4, { date: "01-01" }] }).occasions).toEqual([])
    })

})

describe("the dates a customer mentioned", () => {
    const birthday = { label: "birthday", month: 11, day: 20, year: null }

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

    it("names an occasion in a task suffix and finds it again", () => {
        const suffix = occasionSuffixOf({ label: careSample("occasionBirthday"), month: 11, day: 20, year: null })

        expect(suffix).toBe("sinhnhat-11-20")
        expect(occasionOfSuffix([birthday, { label: careSample("occasionBirthday"), month: 11, day: 20, year: null }], suffix)?.label).toBe(
            careSample("occasionBirthday"),
        )
        expect(occasionOfSuffix([birthday], "nothing")).toBeUndefined()
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

    it("counts the days it waited for a shipment", () => {
        expect(shipAttemptOf(shipSuffixOf(2))).toBe(2)
        expect(shipAttemptOf("")).toBeNull()
        expect(shipAttemptOf("birthday-1-1")).toBeNull()
    })
})
