import { Test } from "@nestjs/testing"
import { PUBLIC_MAIL_PORTS, isValidPort as realIsValidPort } from "./smtp-target.policy"

const SUBJECT = Symbol("smtp-target.policy")

type Subject = Pick<typeof import("./smtp-target.policy"), "isValidPort">

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { isValidPort: realIsValidPort } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("smtp-target policy / isValidPort", () => {
    it("accepts 1 to 65535 and refuses the rest", async () => {
        const subject = await build()

        expect(subject.isValidPort(587)).toBe(true)
        expect(subject.isValidPort(1)).toBe(true)
        expect(subject.isValidPort(65535)).toBe(true)
        expect(subject.isValidPort(0)).toBe(false)
        expect(subject.isValidPort(65536)).toBe(false)
        expect(subject.isValidPort(25.5)).toBe(false)
    })
})

describe("smtp-target policy", () => {
    it("lists the public mail ports", () => {
        expect([...PUBLIC_MAIL_PORTS]).toEqual([25, 465, 587, 2465, 2525, 2587])
    })
})
