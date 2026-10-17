import { Test } from "@nestjs/testing"
import { pickLocale as pickLocaleImplementation } from "./request-locale.policy"

const SUBJECT = Symbol("subject")
type Subject = { pickLocale: typeof pickLocaleImplementation }

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { pickLocale: pickLocaleImplementation } }],
    }).compile()
    const subject = moduleRef.get<Subject>(SUBJECT)
    return { subject }
}

describe("pickLocale", () => {
    it.each([
        ["vi-VN,vi;q=0.9", "vi"],
        ["EN-us", "en"],
        ["fr-FR, de;q=0.8, en;q=0.5, vi;q=0.4", "en"],
        [["fr", "en"], "en"],
        ["fr-FR,de", "vi"],
        [undefined, "vi"],
    ])("picks the locale of %j", async (header, expected) => {
        const { subject } = await buildSubject()

        expect(subject.pickLocale(header)).toBe(expected)
    })
})
