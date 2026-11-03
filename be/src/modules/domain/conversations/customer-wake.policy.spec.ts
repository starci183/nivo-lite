import { customerWakeContextOf } from "./customer-wake.policy"

describe("customerWakeContextOf", () => {
    it("carries the ids and the flag of a customer message, never its words", () => {
        expect(
            customerWakeContextOf({ conversationId: "c-1", messageId: "m-1", channelEventId: "e-1", lookupName: true }),
        ).toEqual({ conversationId: "c-1", messageId: "m-1", channelEventId: "e-1", lookupName: true })
    })
})
