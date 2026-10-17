import { Test } from "@nestjs/testing"
import { isUniqueViolation } from "./database-error.policy"

const SUBJECT = Symbol("database-error.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { isUniqueViolation } }],
    }).compile()
    return moduleRef.get<typeof import("./database-error.policy")>(SUBJECT)
}

describe("isUniqueViolation", () => {
    it("is true for a driver failure with the unique-violation code", async () => {
        const subject = await buildSubject()

        expect(subject.isUniqueViolation(Object.assign(new Error("duplicate key"), { code: "23505" }))).toBe(true)
    })

    it("is false for any other code, an error without one and anything that is not an object", async () => {
        const subject = await buildSubject()

        expect(subject.isUniqueViolation(Object.assign(new Error("other"), { code: "23503" }))).toBe(false)
        expect(subject.isUniqueViolation(new Error("plain"))).toBe(false)
        expect(subject.isUniqueViolation(null)).toBe(false)
        expect(subject.isUniqueViolation("23505")).toBe(false)
    })
})
