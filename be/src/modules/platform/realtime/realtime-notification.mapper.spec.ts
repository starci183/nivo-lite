import { Test } from "@nestjs/testing"
import { readNotification } from "./realtime-notification.mapper"

const SUBJECT: unique symbol = Symbol("realtime.notification.mapper")

const buildSubject = async () => {
    const functions = { readNotification }
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useFactory: () => functions }],
    }).compile()
    return moduleRef.get<typeof functions>(SUBJECT)
}

describe("readNotification", () => {
    it("reads the notification the hub publishes after it wrote a row", async () => {
        const subject = await buildSubject()

        expect(subject.readNotification('{"topic":"booking-status:person-1","seq":42}')).toEqual({
            topic: "booking-status:person-1",
            seq: 42,
        })
    })

    it.each([
        ["text that is not JSON", "not json"],
        ["a JSON value that is not an object", "[1,2]"],
        ["an object without a sequence number", '{"topic":"t"}'],
        ["a negative sequence number", '{"topic":"t","seq":-1}'],
        ["a fractional sequence number", '{"topic":"t","seq":1.5}'],
        ["a topic over the bound", JSON.stringify({ topic: "t".repeat(257), seq: 1 })],
    ])("ignores %s", async (_case, payload) => {
        const subject = await buildSubject()

        expect(subject.readNotification(payload)).toBeUndefined()
    })
})
