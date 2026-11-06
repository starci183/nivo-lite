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
    it("names a room topic by recipient and workspace", async () => {
        const topicOf = await buildSubject()
        expect(topicOf("U1", "WS", { room: "sales" }).name).toBe("chat-typing:U1:ws:room:sales")
    })

    it("names the general office when no room is given", async () => {
        const topicOf = await buildSubject()
        expect(topicOf("U1", "WS", { room: null }).name).toBe("chat-typing:U1:ws:room:office")
    })

    it("isolates another recipient", async () => {
        const topicOf = await buildSubject()
        const target = { room: "sales" }
        expect(topicOf("U1", "ws", target).name).not.toBe(topicOf("U2", "ws", target).name)
    })

    it("accepts only well formed frames", async () => {
        const topicOf = await buildSubject()
        const { accepts } = topicOf("U1", "ws", { room: null })
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
