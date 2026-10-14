import { programSlug } from "./program-slug.policy"

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
    ])("turns %j into the bounded public slug %j", (name, expected) => {
        expect(programSlug(name)).toBe(expected)
    })
})
