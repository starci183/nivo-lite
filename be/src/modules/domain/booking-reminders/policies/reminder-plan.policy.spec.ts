import type * as SubjectModule from "./reminder-plan.policy"
import { Test } from "@nestjs/testing"
import { cardReminderBody, cardReminderHours, hoursOfKind, reminderPlan } from "./reminder-plan.policy"

const SUBJECT = Symbol("reminder-plan.policy")
type Subject = Pick<typeof SubjectModule, "reminderPlan" | "cardReminderHours" | "cardReminderBody" | "hoursOfKind">

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { reminderPlan, cardReminderHours, cardReminderBody, hoursOfKind } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const HOUR = 3_600_000

describe("reminder-plan.policy", () => {
    describe("reminderPlan", () => {
        it("keeps one reminder per offset that is still ahead", async () => {
            const subject = await buildSubject()

            expect(subject.reminderPlan(100 * HOUR, [24, 2, 24], 0)).toEqual([
                { kind: "h24", dueMs: 76 * HOUR },
                { kind: "h2", dueMs: 98 * HOUR },
            ])
        })

        it("drops the offsets that are already past", async () => {
            const subject = await buildSubject()

            expect(subject.reminderPlan(10 * HOUR, [24, 2], 0)).toEqual([{ kind: "h2", dueMs: 8 * HOUR }])
        })
    })

    describe("cardReminderHours", () => {
        it("reads the two offsets of the card", async () => {
            const subject = await buildSubject()

            expect(subject.cardReminderHours({ firstHours: 48, secondHours: "3" })).toEqual([48, 3])
        })

        it("drops offsets that are missing, zero or not numbers", async () => {
            const subject = await buildSubject()

            expect(subject.cardReminderHours({ firstHours: 0, secondHours: "x" })).toEqual([])
            expect(subject.cardReminderHours({})).toEqual([])
            expect(subject.cardReminderHours(null)).toEqual([])
        })
    })

    describe("cardReminderBody", () => {
        it.each([null, undefined, "", " \n\t "])("returns null for missing or blank wording %j", async (body) => {
            const subject = await buildSubject()

            expect(subject.cardReminderBody(body)).toBeNull()
        })

        it("trims the owner's wording", async () => {
            const subject = await buildSubject()

            expect(subject.cardReminderBody("  Ch\u00e0o {{ten_khach}}\n ")).toBe("Ch\u00e0o {{ten_khach}}")
        })
    })

    describe("hoursOfKind", () => {
        it.each([
            ["h24", 24],
            ["h2", 2],
            ["h", 0],
            ["hx", 0],
        ])("reads %s as %d hours", async (kind, hours) => {
            const subject = await buildSubject()

            expect(subject.hoursOfKind(kind)).toBe(hours)
        })
    })
})
