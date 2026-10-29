import { Test } from "@nestjs/testing"
import { hasStoredSize, toVector } from "./vector.policy"

const SUBJECT = Symbol("vector.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { toVector, hasStoredSize } }],
    }).compile()
    return moduleRef.get<{ toVector: typeof toVector; hasStoredSize: typeof hasStoredSize }>(SUBJECT)
}

describe("toVector", () => {
    it("writes the numbers between brackets, comma separated", async () => {
        const subject = await buildSubject()

        expect(subject.toVector([0.5, -1, 2])).toBe("[0.5,-1,2]")
    })

    it("writes an empty vector as empty brackets", async () => {
        const subject = await buildSubject()

        expect(subject.toVector([])).toBe("[]")
    })
})

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
