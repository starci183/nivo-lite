import { Test } from "@nestjs/testing"
import { programSlug } from "./program-slug.policy"

const SUBJECT = Symbol("program-slug.policy")
type Subject = { programSlug: typeof programSlug }

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { programSlug } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("programSlug", () => {
    it.each([
        ["  \u0110\u1eb7ng's Spa & Caf\u00e9  ", "dang-s-spa-cafe"],
        ["ABC_123", "abc-123"],
        ["a", "a-hang"],
        ["ab", "ab-hang"],
        ["", "cua-hang"],
        [" !!! ", "cua-hang"],
        ["abc", "abc"],
        ["ABCDEFGHIJKLMNOPQRSTUVWXYZ12345", "abcdefghijklmnopqrstuvwxyz12"],
        [`${"a".repeat(27)} & longer`, "a".repeat(27)],
    ])("turns %j into the bounded public slug %j", async (name, expected) => {
        const subject = await build()

        expect(subject.programSlug(name)).toBe(expected)
    })
})
