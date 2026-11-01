import { Test } from "@nestjs/testing"
import { resultSchemaOf } from "./intent-result.policy"

const SUBJECT = Symbol("intent-result.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { resultSchemaOf } }],
    }).compile()
    return moduleRef.get<{ resultSchemaOf: typeof resultSchemaOf }>(SUBJECT)
}

describe("resultSchemaOf", () => {
    it("parses each kind of result with its own schema", async () => {
        const subject = await build()

        expect(subject.resultSchemaOf("customer_reply").safeParse({ reply: "Hi" })).toMatchObject({
            success: true,
            data: { reply: "Hi", lead: null },
        })
        expect(subject.resultSchemaOf("agent_request").safeParse({ action: "send_quote" })).toMatchObject({
            success: true,
            data: { action: "send_quote" },
        })
        expect(subject.resultSchemaOf("own_turn_pick").safeParse({})).toMatchObject({ success: true, data: {} })
    })

    it("holds each kind to its own members", async () => {
        const subject = await build()

        expect(subject.resultSchemaOf("own_turn_pick").safeParse({ reply: "Hi" }).success).toBe(false)
        expect(subject.resultSchemaOf("customer_reply").safeParse({ action: "send_quote" }).success).toBe(false)
        expect(subject.resultSchemaOf("agent_request").safeParse({ reply: "Hi" }).success).toBe(false)
    })
})
