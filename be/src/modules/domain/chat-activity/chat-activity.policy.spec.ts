import { Test } from "@nestjs/testing"
import { chatActivityTarget as realTarget, chatActivityTopic as realTopic } from "./chat-activity.policy"

const frame = { id: "message:1", kind: "message", roomOrConversation: "room:sales", at: "2026-10-26T01:00:00.000Z" }

const SUBJECT = Symbol("chat-activity.policy")
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { chatActivityTarget: realTarget, chatActivityTopic: realTopic } }],
    }).compile()
    return moduleRef.get<typeof import("./chat-activity.policy")>(SUBJECT)
}

describe("chatActivityTarget", () => {
    it("names a department room by its key", async () => {
        const { chatActivityTarget } = await buildSubject()
        expect(chatActivityTarget({ room: "sales", conversationId: null })).toBe("room:sales")
    })

    it("names the general Office when no room is given", async () => {
        const { chatActivityTarget } = await buildSubject()
        expect(chatActivityTarget({ room: null, conversationId: null })).toBe("room:office")
    })

    it("names a conversation by its lower-cased id", async () => {
        const { chatActivityTarget } = await buildSubject()
        expect(chatActivityTarget({ room: null, conversationId: "CV-1" })).toBe("conversation:cv-1")
    })
})

describe("chatActivityTopic", () => {
    it("names the topic by recipient and lower-cased workspace", async () => {
        const { chatActivityTopic } = await buildSubject()
        expect(chatActivityTopic("U1", "WS-1").name).toBe("chat-activity:U1:ws-1")
    })

    it("isolates another recipient and another workspace", async () => {
        const { chatActivityTopic } = await buildSubject()
        expect(chatActivityTopic("U1", "ws").name).not.toBe(chatActivityTopic("U2", "ws").name)
        expect(chatActivityTopic("U1", "ws-a").name).not.toBe(chatActivityTopic("U1", "ws-b").name)
    })

    it("accepts every kind of well formed frame", async () => {
        const { accepts } = (await buildSubject()).chatActivityTopic("U1", "ws")
        expect(accepts(frame)).toBe(true)
        expect(accepts({ ...frame, kind: "receipt" })).toBe(true)
        expect(accepts({ ...frame, kind: "unread" })).toBe(true)
    })

    it("refuses malformed frames", async () => {
        const { accepts } = (await buildSubject()).chatActivityTopic("U1", "ws")
        expect(accepts({ ...frame, kind: "typing" })).toBe(false)
        expect(accepts({ ...frame, id: 1 })).toBe(false)
        expect(accepts({ ...frame, roomOrConversation: 1 })).toBe(false)
        expect(accepts({ ...frame, at: 1 })).toBe(false)
        expect(accepts({ id: "x" })).toBe(false)
        expect(accepts({ id: "x", kind: "message" })).toBe(false)
        expect(accepts({ id: "x", kind: "message", roomOrConversation: "r" })).toBe(false)
        expect(accepts(null)).toBe(false)
        expect(accepts("x")).toBe(false)
    })
})
