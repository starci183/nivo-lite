import type * as SubjectModule from "./conversation.policy"
import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import {
    channelOf,
    leadOf,
    proposalDraft,
    proposalQuestion,
    respondentOf,
    roleOf,
    toConversation,
    waitingConversationId,
} from "./conversation.policy"
import type { CustomerConversationRow } from "@modules/domain/agent-conversations"
import type { MessageBrief } from "@modules/domain/agent-messages"
import type { WaitingRow } from "./persistence/chatbot-workbench.rows"

const SUBJECT = Symbol("conversation.policy")
type Subject = Pick<
    typeof SubjectModule,
    | "channelOf"
    | "leadOf"
    | "proposalDraft"
    | "proposalQuestion"
    | "respondentOf"
    | "roleOf"
    | "waitingConversationId"
    | "toConversation"
>

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    channelOf,
                    leadOf,
                    proposalDraft,
                    proposalQuestion,
                    respondentOf,
                    roleOf,
                    waitingConversationId,
                    toConversation,
                },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const conversationOf = builder<CustomerConversationRow>({
    id: "c-1",
    channel: "zalo",
    visitor_name: null,
    lead_id: "l-1",
    agent_id: "agent-1",
    front_agent_id: null,
    handled_by: null,
    handled_at: null,
    external_id: "zalo-9",
    created_at: "2026-10-13T01:00:00.000Z",
})

/** A customer the AI of this desk answers, with no record behind it. */
const PLAIN = { lead: null, respondent: { kind: "ai", name: null } } as const

const messageOf = builder<MessageBrief>({
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
    it.each(["telegram", "zalo", "facebook", "instagram"])("keeps the %s customer channel", async (channel) => {
        const subject = await buildSubject()

        expect(subject.channelOf(channel)).toBe(channel)
    })

    it.each(["website", "webchat", "internal", "ZALO", ""])("represents %s as website chat", async (channel) => {
        const subject = await buildSubject()

        expect(subject.channelOf(channel)).toBe("website")
    })

    it.each([
        ["agent", "agent"],
        ["system", "system"],
        ["user", "user"],
        ["visitor", "user"],
    ])("normalizes role %s to %s", async (stored, expected) => {
        const subject = await buildSubject()

        expect(subject.roleOf(stored)).toBe(expected)
    })

    it("prefers an explicit conversation id, including an empty string, over the subject", async () => {
        const subject = await buildSubject()

        expect(subject.waitingConversationId(waitingOf({ proposal: { fields: { conversation_id: "c-2" } } }))).toBe(
            "c-2",
        )
        expect(subject.waitingConversationId(waitingOf({ proposal: { fields: { conversation_id: "" } } }))).toBe("")
    })

    it.each([
        null,
        {},
        { fields: null },
        { fields: "c-2" },
        { fields: [] },
        { fields: {} },
        { fields: { conversation_id: 2 } },
    ])("falls back to the subject when a proposal has no string conversation id: %j", async (proposal) => {
        const subject = await buildSubject()

        expect(subject.waitingConversationId(waitingOf({ proposal }))).toBe("c-1")
        expect(subject.waitingConversationId(waitingOf({ proposal, subject_id: null }))).toBeNull()
    })

    it("maps an empty conversation using its creation date and no display name", async () => {
        const subject = await buildSubject()

        expect(subject.toConversation(conversationOf(), [], undefined, false, PLAIN)).toEqual({
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
            lead: null,
            respondent: { kind: "ai", name: null },
        })
    })
})

describe("conversation policy", () => {
    it("trims the visitor name and shows the last conversation line while tracking the latest system activity", async () => {
        const subject = await buildSubject()

        const messages = [
            messageOf(),
            messageOf({ id: "m-2", role: "agent", body: "Yes", created_at: "2026-10-13T01:02:00.000Z" }),
            messageOf({ id: "m-3", role: "system", body: "Assigned", created_at: "2026-10-13T01:03:00.000Z" }),
        ]

        const conversation = conversationOf({ visitor_name: "  Minh  " })
        expect(subject.toConversation(conversation, messages, "Hoa", true, {
                lead: { stage: "qualified", need: "T-shirts", company: "Hoa Shop" },
                respondent: { kind: "agent", name: "Sales AI" },
            })).toEqual({
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
            lead: { stage: "qualified", need: "T-shirts", company: "Hoa Shop" },
            respondent: { kind: "agent", name: "Sales AI" },
        })
    })

    it("shows the latest system line when no conversational lines exist", async () => {
        const subject = await buildSubject()

        const result = subject.toConversation(
            conversationOf({ visitor_name: "  " }),
            [messageOf({ role: "system", body: "Opened" })],
            "Hoa",
            false,
            PLAIN,
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

    it("clips long previews to 139 characters with trailing whitespace removed before the ellipsis", async () => {
        const subject = await buildSubject()

        const body = "x".repeat(138) + "  more"

        expect(subject.toConversation(conversationOf(), [messageOf({ body })], "", false, PLAIN).lastText).toBe(
            "x".repeat(138) + "...",
        )
        expect(
            subject.toConversation(conversationOf(), [messageOf({ body: "x".repeat(141) })], "", false, PLAIN).lastText,
        ).toBe("x".repeat(139) + "...")
        expect(
            subject.toConversation(conversationOf(), [messageOf({ body: "x".repeat(140) })], "", false, PLAIN).lastText,
        ).toBe("x".repeat(140))
    })
})

describe("conversation policy", () => {
    it.each([
        [false, null, false],
        [true, null, true],
        [false, "staff-1", true],
    ] as const)(
        "marks the customer's last line unanswered with waiting=%s and handler=%s",
        async (waiting, handledBy, expected) => {
            const subject = await buildSubject()

            const result = subject.toConversation(
                conversationOf({ handled_by: handledBy }),
                [messageOf()],
                undefined,
                waiting,
                PLAIN,
            )

            expect(result.unanswered).toBe(expected)
            expect(result.handledBy).toBe(handledBy)
            expect(result.waiting).toBe(waiting)
        },
    )
})

describe("customer record and respondent", () => {
    const names = new Map([["agent-2", "Sales AI"]])

    it("shows the stage, need and company of a customer, and nothing for a customer not captured", async () => {
        const subject = await buildSubject()

        expect(subject.leadOf({ stage: "proposal", need: "T-shirts", company: "Hoa Shop" })).toEqual({
            stage: "proposal",
            need: "T-shirts",
            company: "Hoa Shop",
        })
        expect(subject.leadOf(undefined)).toBeNull()
    })

    it("names the person who holds the chat before anything else", async () => {
        const subject = await buildSubject()
        const row = conversationOf({ handled_by: "Lan", agent_id: "agent-2", front_agent_id: "agent-1" })

        expect(subject.respondentOf(row, new Set(["agent-1"]), names)).toEqual({ kind: "person", name: "Lan" })
    })

    it("answers with the AI while the agent of the desk speaks, in a chat nobody handed over", async () => {
        const subject = await buildSubject()

        expect(subject.respondentOf(conversationOf(), new Set(["agent-1"]), names)).toEqual({ kind: "ai", name: null })
    })

    it("answers with the AI once the chat is handed back to the front agent", async () => {
        const subject = await buildSubject()
        const row = conversationOf({ agent_id: "agent-1", front_agent_id: "agent-1" })

        expect(subject.respondentOf(row, new Set(["agent-1"]), names)).toEqual({ kind: "ai", name: null })
    })

    it("names the other agent that a hand-over moved the chat to, and an empty name when it is unknown", async () => {
        const subject = await buildSubject()
        const row = conversationOf({ agent_id: "agent-2", front_agent_id: "agent-1" })

        expect(subject.respondentOf(row, new Set(["agent-1"]), names)).toEqual({ kind: "agent", name: "Sales AI" })
        expect(subject.respondentOf(row, new Set(["agent-1"]), new Map())).toEqual({ kind: "agent", name: "" })
    })

    it("reads a thread with no desk as the chat of the agent that was handed it", async () => {
        const subject = await buildSubject()
        const row = conversationOf({ agent_id: "agent-2", front_agent_id: "agent-1" })

        expect(subject.respondentOf(row, new Set(), names)).toEqual({ kind: "agent", name: "Sales AI" })
    })
})

describe("waiting reply proposal", () => {
    it("reads the question field, else the summary, else nothing", async () => {
        const subject = await buildSubject()

        expect(subject.proposalQuestion({ fields: { question: "Warranty?" }, summary: "S" })).toBe("Warranty?")
        expect(subject.proposalQuestion({ fields: { question: 3 }, summary: "S" })).toBe("S")
        expect(subject.proposalQuestion({ fields: [], summary: "S" })).toBe("S")
        expect(subject.proposalQuestion({ summary: 4 })).toBe("")
        expect(subject.proposalQuestion(null)).toBe("")
    })

    it("reads the draft when it is text, else nothing", async () => {
        const subject = await buildSubject()

        expect(subject.proposalDraft({ draft: "Hello" })).toBe("Hello")
        expect(subject.proposalDraft({ draft: 1 })).toBe("")
        expect(subject.proposalDraft(null)).toBe("")
    })
})
