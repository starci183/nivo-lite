import { Test } from "@nestjs/testing"
import { zaloDeliveryIdOf as realZaloDeliveryIdOf } from "./zalo-delivery-id.policy"

const SUBJECT = Symbol("zalo-delivery-id.policy")
type Subject = { zaloDeliveryIdOf: typeof realZaloDeliveryIdOf }

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { zaloDeliveryIdOf: realZaloDeliveryIdOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const bytes = (value: unknown): Buffer => Buffer.from(JSON.stringify(value))

describe("zaloDeliveryIdOf", () => {
    it("keeps the message id of a customer text, scoped by the connection", async () => {
        const subject = await buildSubject()
        const text = { event_name: "user_send_text", sender: { id: "u" }, message: { msg_id: "m-1", text: "hi" } }

        expect(subject.zaloDeliveryIdOf("c-1", bytes(text))).toBe("c-1:m-1")
    })

    it("derives the id of another event from its name, timestamp and sender", async () => {
        const subject = await buildSubject()
        const follow = bytes({ event_name: "follow", timestamp: 5, follower: { id: "u-1" } })
        const seen = bytes({ event_name: "user_seen_message", timestamp: "5", sender: { id: "u-1" } })

        expect(subject.zaloDeliveryIdOf("c-1", follow)).toBe("c-1:follow:5:u-1")
        expect(subject.zaloDeliveryIdOf("c-1", seen)).toBe("c-1:user_seen_message:5:u-1")
    })

    it("separates connections and senders", async () => {
        const subject = await buildSubject()
        const follow = bytes({ event_name: "follow", timestamp: "5", follower: { id: "u-1" } })
        const other = bytes({ event_name: "follow", timestamp: "5", follower: { id: "u-2" } })

        expect(subject.zaloDeliveryIdOf("c-1", follow)).not.toBe(subject.zaloDeliveryIdOf("c-2", follow))
        expect(subject.zaloDeliveryIdOf("c-1", follow)).not.toBe(subject.zaloDeliveryIdOf("c-1", other))
    })

    it("hashes a body without an event name or timestamp, and never answers an empty id", async () => {
        const subject = await buildSubject()
        const first = subject.zaloDeliveryIdOf("c-1", bytes({ event_name: "follow" }))

        expect(first).toMatch(/^c-1:raw:[0-9a-f]{64}$/u)
        expect(subject.zaloDeliveryIdOf("c-1", Buffer.from("not json"))).toMatch(/^c-1:raw:/u)
        expect(first).toBe(subject.zaloDeliveryIdOf("c-1", bytes({ event_name: "follow" })))
        expect(first).not.toBe(subject.zaloDeliveryIdOf("c-1", bytes({ event_name: "unfollow" })))
    })
})
