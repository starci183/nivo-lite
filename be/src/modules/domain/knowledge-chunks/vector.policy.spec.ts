import { Test } from "@nestjs/testing"
import { toVector } from "./vector.policy"

const SUBJECT = Symbol("vector.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { toVector } }],
    }).compile()
    return moduleRef.get<{ toVector: typeof toVector }>(SUBJECT)
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
