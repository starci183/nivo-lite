import { Test } from "@nestjs/testing"
import { customerBirthday } from "./customer-birthday.policy"

const SUBJECT = Symbol("customer-birthday.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { customerBirthday } }],
    }).compile()
    return moduleRef.get<typeof import("./customer-birthday.policy")>(SUBJECT)
}

describe("customerBirthday", () => {
    it.each(["1990-10-03", "2000-02-29", "2024-02-29", "0000-01-01"])(
        "preserves a real calendar date %s",
        async (value) => {
            const subject = await buildSubject()

            expect(subject.customerBirthday(value)).toBe(value)
        },
    )

    it("returns null for an absent birthday", async () => {
        const subject = await buildSubject()

        expect(subject.customerBirthday(null)).toBeNull()
    })

    it.each(["", "1990-1-03", "1990-10-3", " 1990-10-03", "1990-10-03T00:00:00.000Z", "birthday"])(
        "returns null for a birthday outside the exact date format %p",
        async (value) => {
            const subject = await buildSubject()

            expect(subject.customerBirthday(value)).toBeNull()
        },
    )

    it.each(["2026-13-01", "2026-00-01", "2026-01-00", "2026-01-32"])(
        "returns null when the date cannot be parsed %s",
        async (value) => {
            const subject = await buildSubject()

            expect(subject.customerBirthday(value)).toBeNull()
        },
    )

    it.each(["2026-02-29", "1900-02-29", "2026-02-30", "2026-04-31"])(
        "returns null when parsing rolls a nonexistent date into another day %s",
        async (value) => {
            const subject = await buildSubject()

            expect(subject.customerBirthday(value)).toBeNull()
        },
    )
})
