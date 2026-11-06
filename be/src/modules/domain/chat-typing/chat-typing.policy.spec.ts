import { Test } from "@nestjs/testing"
import { chatTypingTopic } from "./chat-typing.policy"

const SUBJECT: unique symbol = Symbol("chat-typing.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useFactory: () => chatTypingTopic }],
    }).compile()
    return moduleRef.get<typeof chatTypingTopic>(SUBJECT)
}

const frame = { id: "a:t", actorId: "a", actorName: "An", state: "start", at: "t" }

describe("chatTypingTopic", () => {
    it("names a room topic by recipient, workspace and room id", async () => {
        const topicOf = await buildSubject()
        expect(topicOf("U1", "WS", "Room-1").name).toBe("chat-typing:U1:ws:room:room-1")
    })

    it("isolates another recipient", async () => {
        const topicOf = await buildSubject()
        expect(topicOf("U1", "ws", "r1").name).not.toBe(topicOf("U2", "ws", "r1").name)
        expect(topicOf("U1", "ws", "r1").name).not.toBe(topicOf("U1", "ws", "r2").name)
    })

    it("accepts only well formed frames", async () => {
        const topicOf = await buildSubject()
        const { accepts } = topicOf("U1", "ws", "r1")
        expect(accepts(frame)).toBe(true)
        expect(accepts({ ...frame, state: "pause" })).toBe(false)
        expect(accepts({ ...frame, id: 1 })).toBe(false)
        expect(accepts({ ...frame, actorId: 1 })).toBe(false)
        expect(accepts({ ...frame, actorName: 1 })).toBe(false)
        expect(accepts({ ...frame, at: 1 })).toBe(false)
        expect(accepts(null)).toBe(false)
        expect(accepts("x")).toBe(false)
    })
})
