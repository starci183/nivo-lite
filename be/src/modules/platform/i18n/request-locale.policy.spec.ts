import { pickLocale } from "./request-locale.policy"

describe("pickLocale", () => {
    it.each([
        ["vi-VN,vi;q=0.9", "vi"],
        ["EN-us", "en"],
        ["fr-FR, de;q=0.8, en;q=0.5, vi;q=0.4", "en"],
        [["fr", "en"], "en"],
        ["fr-FR,de", "vi"],
        [undefined, "vi"],
    ])("picks the locale of %j", (header, expected) => {
        expect(pickLocale(header)).toBe(expected)
    })
})
