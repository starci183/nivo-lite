import { Test } from "@nestjs/testing"
import type { ConversationFacts } from "./chat-conversation.policy"
import { followersOf } from "./chat-followers.policy"
import type { LineFacts } from "./chat-lines.policy"

/** The members of the subject under test. */
interface Subject {
    readonly followersOf: typeof followersOf
}

const SUBJECT = Symbol("chat-followers.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { followersOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const conversation = (id: string, externalId: string | null, name: string): ConversationFacts => ({
    id,
    version: "1",
    workspaceId: "w",
    agentId: "a",
    leadId: null,
    data: {
        channel: "zalo",
        connectionId: "k",
        externalId,
        name,
        waiting: false,
        handledBy: null,
        lastText: "",
        lastRole: null,
        lastAt: null,
        messageCount: 0,
        agentId: "a",
        frontAgentId: null,
        connectorPartyId: null,
        connectorPartyName: null,
    },
})

const line = (id: string, conversationId: string, sentAt: string): LineFacts => ({
    id,
    version: "1",
    data: {
        conversationId,
        role: "user",
        text: "hi",
        sentAt,
        deliveryStatus: null,
        deliveryError: null,
        channelRef: null,
    },
})

describe("followersOf", () => {
    it("lists one follower per conversation with the time of the newest line, in the order given", async () => {
        const subject = await build()
        const conversations = [conversation("c1", "u1", "An"), conversation("c2", "u2", "")]
        const lines = [
            line("m3", "c2", "2026-11-06T03:00:00.000Z"),
            line("m2", "c1", "2026-11-06T02:00:00.000Z"),
            line("m1", "c2", "2026-11-06T01:00:00.000Z"),
        ]
        expect(subject.followersOf(conversations, lines)).toEqual([
            { conversationId: "c2", externalId: "u2", name: "", lastAt: "2026-11-06T03:00:00.000Z" },
            { conversationId: "c1", externalId: "u1", name: "An", lastAt: "2026-11-06T02:00:00.000Z" },
        ])
    })

    it("leaves out a conversation with no customer id and a line of a conversation that was not listed", async () => {
        const subject = await build()
        const lines = [line("m1", "c1", "2026-11-06T03:00:00.000Z"), line("m2", "gone", "2026-11-06T02:00:00.000Z")]
        expect(subject.followersOf([conversation("c1", null, "An")], lines)).toEqual([])
    })
})
