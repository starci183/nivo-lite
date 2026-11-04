import { Test } from "@nestjs/testing"
import { customerWakeContextOf } from "./customer-wake.policy"

const SUBJECT = Symbol("customer-wake.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { customerWakeContextOf } }],
    }).compile()
    return moduleRef.get<typeof import("./customer-wake.policy")>(SUBJECT)
}

describe("customerWakeContextOf", () => {
    it("carries the ids and the flag of a customer message, never its words", async () => {
        const subject = await buildSubject()

        expect(
            subject.customerWakeContextOf({
                conversationId: "c-1",
                messageId: "m-1",
                channelEventId: "e-1",
                lookupName: true,
            }),
        ).toEqual({ conversationId: "c-1", messageId: "m-1", channelEventId: "e-1", lookupName: true })
    })
})
