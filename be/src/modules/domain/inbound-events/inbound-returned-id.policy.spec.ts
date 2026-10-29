import { Test } from "@nestjs/testing"
import { returnedIdOf } from "./inbound-returned-id.policy"
const POLICY = Symbol("./inbound-returned-id.policy")
type PolicySubject = { returnedIdOf: typeof returnedIdOf }

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: POLICY, useValue: { returnedIdOf } }],
    }).compile()
    const subject = moduleRef.get<PolicySubject>(POLICY)
    return { subject }
}

describe("inbound returned id policy", () => {
    it("reads the id of the first returned row", async () => {
        const { subject } = await buildSubject()

        expect(subject.returnedIdOf([{ id: "event-1" }, { id: "event-2" }])).toBe("event-1")
    })

    it("answers undefined when the write returned nothing readable", async () => {
        const { subject } = await buildSubject()

        expect(subject.returnedIdOf([])).toBeUndefined()
        expect(subject.returnedIdOf(undefined)).toBeUndefined()
        expect(subject.returnedIdOf([null])).toBeUndefined()
        expect(subject.returnedIdOf([{ name: "x" }])).toBeUndefined()
        expect(subject.returnedIdOf([{ id: 7 }])).toBeUndefined()
    })
})
