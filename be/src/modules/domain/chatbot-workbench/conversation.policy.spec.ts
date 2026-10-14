import { builder } from "@starci/jest-preset"
import { channelOf, roleOf, toConversation, waitingConversationId } from "./conversation.policy"
import type { ConversationRow, MessageBriefRow, WaitingRow } from "./persistence/chatbot-workbench.rows"

const conversationOf = builder<ConversationRow>({
    id: "c-1",
    channel: "zalo",
    visitor_name: null,
    lead_id: "l-1",
    handled_by: null,
    handled_at: null,
    external_id: "zalo-9",
    created_at: "2026-10-13T01:00:00.000Z",
})

const messageOf = builder<MessageBriefRow>({
    id: "m-1",
    conversation_id: "c-1",
    role: "user",
    body: "Is it in stock?",
    created_at: "2026-10-13T01:01:00.000Z",
})

const waitingOf = builder<WaitingRow>({
    id: "w-1",
    subject_id: "c-1",
    proposal: null,
    assigned_staff_id: null,
    created_at: "2026-10-13T01:02:00.000Z",
})

describe("conversation policy", () => {
    it.each(["telegram", "zalo", "facebook", "instagram"])("keeps the %s customer channel", (channel) => {
        expect(channelOf(channel)).toBe(channel)
    })

    it.each(["website", "webchat", "internal", "ZALO", ""])("represents %s as website chat", (channel) => {
        expect(channelOf(channel)).toBe("website")
    })

    it.each([
        ["agent", "agent"],
        ["system", "system"],
        ["user", "user"],
        ["visitor", "user"],
    ])("normalizes role %s to %s", (stored, expected) => {
        expect(roleOf(stored)).toBe(expected)
    })

    it("prefers an explicit conversation id, including an empty string, over the subject", () => {
        expect(waitingConversationId(waitingOf({ proposal: { fields: { conversation_id: "c-2" } } }))).toBe("c-2")
        expect(waitingConversationId(waitingOf({ proposal: { fields: { conversation_id: "" } } }))).toBe("")
    })

    it.each([
        null,
        {},
        { fields: null },
        { fields: "c-2" },
        { fields: [] },
        { fields: {} },
        { fields: { conversation_id: 2 } },
    ])("falls back to the subject when a proposal has no string conversation id: %j", (proposal) => {
        expect(waitingConversationId(waitingOf({ proposal }))).toBe("c-1")
        expect(waitingConversationId(waitingOf({ proposal, subject_id: null }))).toBeNull()
    })

    it("maps an empty conversation using its creation date and no display name", () => {
        expect(toConversation(conversationOf(), [], undefined, false)).toEqual({
            id: "c-1",
            channel: "zalo",
            name: "",
            leadId: "l-1",
            lastText: "",
            lastRole: null,
            lastAt: "2026-10-13T01:00:00.000Z",
            messageCount: 0,
            handledBy: null,
            waiting: false,
            unanswered: false,
        })
    })

    it("trims the visitor name and shows the last conversation line while tracking the latest system activity", () => {
        const messages = [
            messageOf(),
            messageOf({ id: "m-2", role: "agent", body: "Yes", created_at: "2026-10-13T01:02:00.000Z" }),
            messageOf({ id: "m-3", role: "system", body: "Assigned", created_at: "2026-10-13T01:03:00.000Z" }),
        ]

        expect(toConversation(conversationOf({ visitor_name: "  Minh  " }), messages, "Hoa", true)).toEqual({
            id: "c-1",
            channel: "zalo",
            name: "Minh",
            leadId: "l-1",
            lastText: "Yes",
            lastRole: "agent",
            lastAt: "2026-10-13T01:03:00.000Z",
            messageCount: 2,
            handledBy: null,
            waiting: true,
            unanswered: false,
        })
    })

    it("shows the latest system line when no conversational lines exist", () => {
        const result = toConversation(
            conversationOf({ visitor_name: "  " }),
            [messageOf({ role: "system", body: "Opened" })],
            "Hoa",
            false,
        )

        expect(result).toMatchObject({
            name: "Hoa",
            lastText: "Opened",
            lastRole: "system",
            lastAt: "2026-10-13T01:01:00.000Z",
            messageCount: 0,
            unanswered: false,
        })
    })

    it("clips long previews to 139 characters with trailing whitespace removed before the ellipsis", () => {
        const body = "x".repeat(138) + "  more"

        expect(toConversation(conversationOf(), [messageOf({ body })], "", false).lastText).toBe(
            "x".repeat(138) + "...",
        )
        expect(toConversation(conversationOf(), [messageOf({ body: "x".repeat(141) })], "", false).lastText).toBe(
            "x".repeat(139) + "...",
        )
        expect(toConversation(conversationOf(), [messageOf({ body: "x".repeat(140) })], "", false).lastText).toBe(
            "x".repeat(140),
        )
    })

    it.each([
        [false, null, false],
        [true, null, true],
        [false, "staff-1", true],
    ] as const)(
        "marks the customer's last line unanswered with waiting=%s and handler=%s",
        (waiting, handledBy, expected) => {
            const result = toConversation(conversationOf({ handled_by: handledBy }), [messageOf()], undefined, waiting)

            expect(result.unanswered).toBe(expected)
            expect(result.handledBy).toBe(handledBy)
            expect(result.waiting).toBe(waiting)
        },
    )
})
