import { Test } from "@nestjs/testing"
import { isBearerCredential } from "./bearer-credential.policy"

const SUBJECT = Symbol("bearer-credential.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { isBearerCredential } }],
    }).compile()
    return moduleRef.get<{ isBearerCredential: typeof isBearerCredential }>(SUBJECT)
}

describe("bearer-credential policy", () => {
    it("takes a one-line value of at most 4096 characters", async () => {
        const subject = await buildSubject()

        expect(subject.isBearerCredential("bearer-1")).toBe(true)
        expect(subject.isBearerCredential("x".repeat(4096))).toBe(true)
    })

    it.each([
        ["a blank value", "   "],
        ["a line break", "line\nbreak"],
        ["a carriage return", "line\rbreak"],
        ["a value over 4096 characters", "x".repeat(4097)],
    ])("refuses %s", async (_name, value) => {
        const subject = await buildSubject()

        expect(subject.isBearerCredential(value)).toBe(false)
    })
})
