import type * as SubjectModule from "./thread.mapper"
import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import { buildChatbotThread } from "./thread.mapper"
import type { CustomerConversationRow } from "@modules/domain/agent-conversations"
import type { ChatThreadLine } from "@modules/domain/agent-messages"
import type { LeadRow, WaitingRow } from "./persistence/chatbot-workbench.rows"

const SUBJECT = Symbol("thread.mapper")
type Subject = Pick<typeof SubjectModule, "buildChatbotThread">

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { buildChatbotThread } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const conversationOf = builder<CustomerConversationRow>({
    id: "c-1",
    channel: "zalo",
    agent_id: "agent-1",
    front_agent_id: null,
    visitor_name: null,
    lead_id: "l-1",
    handled_by: null,
    handled_at: null,
    external_id: "zalo-9",
    created_at: "2026-10-13T01:00:00.000Z",
})

const messageOf = builder<ChatThreadLine>({
    id: "m-1",
    conversation_id: "c-1",
    role: "user",
    body: "Price?",
    created_at: "2026-10-13T01:01:00.000Z",
    author_kind: null,
    author_name: null,
    delivery_status: null,
    delivery_error: null,
})

const waitingOf = builder<WaitingRow>({
    id: "w-1",
    subject_id: "c-1",
    proposal: null,
    assigned_staff_id: null,
    created_at: "2026-10-13T01:02:00.000Z",
})

const LEAD: LeadRow = {
    id: "l-1",
    contact_name: "Hoa",
    company: "Hoa Shop",
    stage: "new",
    need: "T-shirts",
    phone: "0901000000",
    email: "hoa@example.test",
}

const EXPECTED_THREAD = {
    conversation: {
        id: "c-1",
        channel: "zalo",
        name: "Hoa",
        leadId: "l-1",
        lastText: "Price?",
        lastRole: "user",
        lastAt: "2026-10-13T01:01:00.000Z",
        messageCount: 3,
        handledBy: null,
        waiting: true,
        unanswered: false,
        lead: { stage: "new", need: "T-shirts", company: "Hoa Shop" },
        respondent: { kind: "ai", name: null },
    },
    messages: [
        {
            id: "m-1",
            role: "user",
            authorKind: "ai",
            authorName: null,
            body: "Price?",
            createdAt: "2026-10-13T01:01:00.000Z",
            delivery: null,
            deliveryError: null,
            files: [],
        },
        {
            id: "m-2",
            role: "agent",
            authorKind: "human",
            authorName: "Lan",
            body: "200k",
            createdAt: "2026-10-13T01:01:00.000Z",
            delivery: "sent",
            deliveryError: null,
            files: [],
        },
        {
            id: "m-3",
            role: "system",
            authorKind: "ai",
            authorName: null,
            body: "Retry failed",
            createdAt: "2026-10-13T01:01:00.000Z",
            delivery: "failed",
            deliveryError: "zalo_window_expired",
            files: [],
        },
        {
            id: "m-4",
            role: "user",
            authorKind: "ai",
            authorName: null,
            body: "Price?",
            createdAt: "2026-10-13T01:01:00.000Z",
            delivery: null,
            deliveryError: null,
            files: [],
        },
    ],
    lead: {
        id: "l-1",
        name: "Hoa",
        company: "Hoa Shop",
        stage: "new",
        need: "T-shirts",
        phone: "0901000000",
        email: "hoa@example.test",
    },
    escalation: {
        workItemId: "w-1",
        question: "Can you confirm?",
        draft: "It costs 200k",
        staffName: "Minh",
        since: "2026-10-13T01:02:00.000Z",
    },
    externalId: "zalo-9",
    handledAt: "2026-10-13T01:03:00.000Z",
}

describe("chatbot thread mapper", () => {
    it("maps the conversation, complete lead, delivery states and first matching escalation", async () => {
        const subject = await buildSubject()

        const result = subject.buildChatbotThread({
            conversation: conversationOf({ handled_at: new Date("2026-10-13T01:03:00.000Z") }),
            messages: [
                messageOf(),
                messageOf({
                    id: "m-2",
                    role: "agent",
                    author_kind: "human",
                    author_name: "Lan",
                    body: "200k",
                    delivery_status: "sent",
                }),
                messageOf({
                    id: "m-3",
                    role: "system",
                    author_kind: "ai",
                    body: "Retry failed",
                    delivery_status: "failed",
                    delivery_error: "zalo_window_expired",
                }),
                messageOf({ id: "m-4", role: "visitor", delivery_status: "pending" }),
            ],
            files: [],
            waiting: [
                waitingOf({ id: "unrelated", subject_id: "c-2" }),
                waitingOf({
                    subject_id: null,
                    proposal: {
                        fields: { conversation_id: "c-1", question: "Can you confirm?" },
                        summary: "Price",
                        draft: "It costs 200k",
                    },
                }),
                waitingOf({ id: "later", proposal: { summary: "Later question" } }),
            ],
            lead: LEAD,
            staffName: "Minh",
            agentNames: new Map(),
        })

        expect(result).toEqual(EXPECTED_THREAD)
    })
})

describe("chatbot thread mapper", () => {
    it("returns absent optional records and a conversation creation timestamp for an empty thread", async () => {
        const subject = await buildSubject()

        expect(
            subject.buildChatbotThread({
                conversation: conversationOf({ lead_id: null, external_id: null }),
                messages: [],
                files: [],
                waiting: [],
                lead: null,
                staffName: null,
                agentNames: new Map(),
            }),
        ).toEqual({
            conversation: {
                id: "c-1",
                channel: "zalo",
                name: "",
                leadId: null,
                lastText: "",
                lastRole: null,
                lastAt: "2026-10-13T01:00:00.000Z",
                messageCount: 0,
                handledBy: null,
                waiting: false,
                unanswered: false,
                lead: null,
                respondent: { kind: "ai", name: null },
            },
            messages: [],
            lead: null,
            escalation: null,
            externalId: null,
            handledAt: null,
        })
    })

    it.each([
        { proposal: null, question: "", draft: "" },
        { proposal: {}, question: "", draft: "" },
        { proposal: { fields: null, summary: "Summary" }, question: "Summary", draft: "" },
        { proposal: { fields: "invalid", summary: "Summary", draft: 42 }, question: "Summary", draft: "" },
        { proposal: { fields: [], summary: "Summary" }, question: "Summary", draft: "" },
        { proposal: { fields: {}, summary: "Summary" }, question: "Summary", draft: "" },
        { proposal: { fields: { question: 42 }, summary: "Summary" }, question: "Summary", draft: "" },
        { proposal: { fields: { question: "" }, summary: "Summary", draft: "Draft" }, question: "", draft: "Draft" },
        { proposal: { fields: { question: false }, summary: false }, question: "", draft: "" },
    ])("normalizes escalation question and draft from $proposal", async ({ proposal, question, draft }) => {
        const subject = await buildSubject()

        const result = subject.buildChatbotThread({
            conversation: conversationOf(),
            messages: [],
            files: [],
            waiting: [waitingOf({ proposal })],
            lead: null,
            staffName: null,
            agentNames: new Map(),
        })

        expect(result.escalation).toEqual({
            workItemId: "w-1",
            question,
            draft,
            staffName: null,
            since: "2026-10-13T01:02:00.000Z",
        })
        expect(result.conversation.waiting).toBe(true)
    })
})

describe("chatbot thread mapper respondent", () => {
    it("names the agent a hand-over moved the thread to, and the person who holds it first", async () => {
        const subject = await buildSubject()
        const handed = conversationOf({ agent_id: "agent-2", front_agent_id: "agent-1" })
        const base = {
            messages: [],
            files: [],
            waiting: [],
            lead: null,
            staffName: null,
            agentNames: new Map([["agent-2", "Sales AI"]]),
        }

        expect(subject.buildChatbotThread({ ...base, conversation: handed }).conversation.respondent).toEqual({
            kind: "agent",
            name: "Sales AI",
        })
        expect(
            subject.buildChatbotThread({ ...base, conversation: { ...handed, handled_by: "Lan" } }).conversation
                .respondent,
        ).toEqual({ kind: "person", name: "Lan" })
    })
})
