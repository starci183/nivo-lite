import { Test } from "@nestjs/testing"
import { PROVIDER, TRIGGER } from "@nivo-lite/agent-sdk/names"
import { TEAM_CHAT_MESSAGE_TRIGGER as realTrigger } from "./team-chat-message.trigger"

const SUBJECT = Symbol("team-chat-message.trigger")

const buildSubject = async (): Promise<typeof realTrigger> => {
    const moduleRef = await Test.createTestingModule({ providers: [{ provide: SUBJECT, useValue: realTrigger }] }).compile()
    return moduleRef.get<typeof realTrigger>(SUBJECT)
}

const NO_ACCOUNT = { connectionId: null }

describe("the team chat's trigger", () => {
    it("is the engine's chat verb, received inside NIVO, keyed by the room thread", async () => {
        const trigger = await buildSubject()

        expect([trigger.provider, trigger.verb, trigger.via, trigger.key]).toEqual([
            PROVIDER.nivo,
            TRIGGER.chatMessageReceived,
            "internal",
            { by: "data", member: "threadId" },
        ])
    })

    it("translates a tag into one event per (message, agent) under the tag's old once-key, purely, naming no person", async () => {
        const trigger = await buildSubject()
        const tag = { roomId: "room-1", messageId: "msg-1", text: "@sales gui bao gia", agentId: "agent-1", actorMemberId: "member-1" }

        const event = trigger.translate(tag, NO_ACCOUNT)
        expect(event).toEqual({
            id: "chat-tag:msg-1:agent-1",
            data: { threadId: "room-1", roomId: "room-1", messageId: "msg-1", text: "@sales gui bao gia", actorMemberId: "member-1" },
        })
        expect(trigger.translate(tag, NO_ACCOUNT)).toEqual(event)
        expect(event?.subject).toBeUndefined()
        expect(trigger.data.safeParse(event?.data).success).toBe(true)
        expect(trigger.translate({ ...tag, agentId: "agent-2" }, NO_ACCOUNT)?.id).toBe("chat-tag:msg-1:agent-2")
    })

    it("drops a tag with no room, message or agent", async () => {
        const trigger = await buildSubject()

        expect(trigger.translate({ roomId: "", messageId: "m", text: "x", agentId: "a", actorMemberId: "m-1" }, NO_ACCOUNT)).toBeNull()
        expect(trigger.translate({ roomId: "r", messageId: "m", text: "x", agentId: "", actorMemberId: "m-1" }, NO_ACCOUNT)).toBeNull()
    })
})
