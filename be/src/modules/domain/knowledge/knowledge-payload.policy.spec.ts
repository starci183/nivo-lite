import { Test } from "@nestjs/testing"
import { reembedPayloadOf, sourcePayloadOf } from "./knowledge-payload.policy"

const SUBJECT = Symbol("knowledge-payload.policy")
type Subject = { sourcePayloadOf: typeof sourcePayloadOf; reembedPayloadOf: typeof reembedPayloadOf }

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { sourcePayloadOf, reembedPayloadOf } }],
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

describe("reembedPayloadOf", () => {
    it("gives back a payload with a workspace and an optional model", async () => {
        const subject = await build()

        expect(subject.reembedPayloadOf({ workspaceId: "w1" })).toEqual({ workspaceId: "w1" })
        expect(subject.reembedPayloadOf({ workspaceId: "w1", model: "m" })).toEqual({ workspaceId: "w1", model: "m" })
    })

    it("gives nothing for any other payload", async () => {
        const subject = await build()

        expect(subject.reembedPayloadOf({ model: "m" })).toBeNull()
    })
})
