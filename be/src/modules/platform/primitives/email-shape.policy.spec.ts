import { Test } from "@nestjs/testing"
import { hasEmailAddressShape } from "./email-shape.policy"

const SUBJECT = Symbol("email-shape.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { hasEmailAddressShape } }],
    }).compile()
    return moduleRef.get<typeof import("./email-shape.policy")>(SUBJECT)
}

describe("hasEmailAddressShape", () => {
    it.each<[string, boolean]>([
        ["a@b.cd", true],
        ["a@b..cd", true],
        ["a@...", true],
        ["a@b..", true],
        ["a@.b.cd", true],
        ["a@b.cd.", true],
        ["A@B.CD", true],
        ["", false],
        ["@b.cd", false],
        ["a@", false],
        ["a@b", false],
        ["a@.b", false],
        ["a@b.", false],
        ["a@@b.cd", false],
        [" a@b.cd", false],
        ["a@b.cd ", false],
        ["a@b.cd\n", false],
        ["a\u00a0b@c.cd", false],
        ["a@b\u2028.cd", false],
    ])("keeps the permissive unnormalized shape for %j", async (value, expected) => {
        const subject = await build()
        expect(subject.hasEmailAddressShape(value)).toBe(expected)
    })

    it("refuses long malformed domains and repeated separators", async () => {
        const subject = await build()
        expect(subject.hasEmailAddressShape("a@" + "b".repeat(24000))).toBe(false)
        expect(subject.hasEmailAddressShape("a" + "@".repeat(24000) + "b.cd")).toBe(false)
    })
})
