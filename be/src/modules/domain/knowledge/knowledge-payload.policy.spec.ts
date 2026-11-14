import { Test } from "@nestjs/testing"
import { sourcePayloadOf } from "./knowledge-payload.policy"

const SUBJECT = Symbol("knowledge-payload.policy")
type Subject = { sourcePayloadOf: typeof sourcePayloadOf }

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { sourcePayloadOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

describe("sourcePayloadOf", () => {
    it("gives back a payload with a source and a workspace", async () => {
        const subject = await build()

        const payload = { sourceId: "s1", workspaceId: "w1" }

        expect(subject.sourcePayloadOf(payload)).toBe(payload)
    })

    it("gives nothing for any other payload", async () => {
        const subject = await build()

        expect(subject.sourcePayloadOf({ sourceId: "s1" })).toBeNull()
    })
})
