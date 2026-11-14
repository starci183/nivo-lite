import { Test } from "@nestjs/testing"
import { hasStoredSize } from "./vector.policy"

const SUBJECT = Symbol("vector.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { hasStoredSize } }],
    }).compile()
    return moduleRef.get<{ hasStoredSize: typeof hasStoredSize }>(SUBJECT)
}

describe("hasStoredSize", () => {
    const vector = (size: number): Array<number> => Array.from({ length: size }, () => 0)

    it("accepts one vector of the stored size per text", async () => {
        const subject = await buildSubject()

        expect(subject.hasStoredSize([vector(1536), vector(1536)], 2)).toBe(true)
    })

    it("refuses another count or another size", async () => {
        const subject = await buildSubject()

        expect(subject.hasStoredSize([vector(1536)], 2)).toBe(false)
        expect(subject.hasStoredSize([vector(768)], 1)).toBe(false)
    })
})
