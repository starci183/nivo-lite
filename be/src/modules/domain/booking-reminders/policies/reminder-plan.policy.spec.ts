import { cardReminderBody, cardReminderHours, hoursOfKind, reminderPlan } from "./reminder-plan.policy"

const HOUR = 3_600_000

describe("reminder-plan.policy", () => {
    describe("reminderPlan", () => {
        it("keeps one reminder per offset that is still ahead", () => {
            expect(reminderPlan(100 * HOUR, [24, 2, 24], 0)).toEqual([
                { kind: "h24", dueMs: 76 * HOUR },
                { kind: "h2", dueMs: 98 * HOUR },
            ])
        })

        it("drops the offsets that are already past", () => {
            expect(reminderPlan(10 * HOUR, [24, 2], 0)).toEqual([{ kind: "h2", dueMs: 8 * HOUR }])
        })
    })

    describe("cardReminderHours", () => {
        it("reads the two offsets of the card", () => {
            expect(cardReminderHours({ firstHours: 48, secondHours: "3" })).toEqual([48, 3])
        })

        it("drops offsets that are missing, zero or not numbers", () => {
            expect(cardReminderHours({ firstHours: 0, secondHours: "x" })).toEqual([])
            expect(cardReminderHours({})).toEqual([])
            expect(cardReminderHours(null)).toEqual([])
        })
    })

    describe("cardReminderBody", () => {
        it.each([null, undefined, "", " \n\t "])("returns null for missing or blank wording %j", (body) => {
            expect(cardReminderBody(body)).toBeNull()
        })

        it("trims the owner's wording", () => {
            expect(cardReminderBody("  Ch\u00e0o {{ten_khach}}\n ")).toBe("Ch\u00e0o {{ten_khach}}")
        })
    })

    describe("hoursOfKind", () => {
        it.each([
            ["h24", 24],
            ["h2", 2],
            ["h", 0],
            ["hx", 0],
        ])("reads %s as %d hours", (kind, hours) => {
            expect(hoursOfKind(kind)).toBe(hours)
        })
    })
})
