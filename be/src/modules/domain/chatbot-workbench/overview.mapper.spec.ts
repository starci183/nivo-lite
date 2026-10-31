import type * as SubjectModule from "./overview.mapper"
import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import { buildChatbotOverview, emptyChatbotOverview } from "./overview.mapper"
import type { CustomerConversationRow } from "@modules/domain/agent-conversations"
import type { MessageBrief } from "@modules/domain/agent-messages"
import type { WaitingRow } from "./persistence/chatbot-workbench.rows"

const SUBJECT = Symbol("overview.mapper")
type Subject = Pick<typeof SubjectModule, "emptyChatbotOverview" | "buildChatbotOverview">

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { emptyChatbotOverview, buildChatbotOverview } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const NOW = Date.parse("2026-10-13T03:00:00.000Z")
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
    created_at: "2026-10-12T17:00:00.000Z",
})

const messageOf = builder<MessageBrief>({
    id: "m-1",
    conversation_id: "c-1",
    role: "user",
    body: "Price?",
    created_at: "2026-10-13T01:00:00.000Z",
})

const waitingOf = builder<WaitingRow>({
    id: "w-1",
    subject_id: "c-1",
    proposal: null,
    assigned_staff_id: null,
    created_at: "2026-10-13T01:02:00.000Z",
})

/** The desk being read, with no other agent and no staff named. */
const DESK = { agentIds: ["agent-1"], agentNames: new Map<string, string>(), staffNames: new Map<string, string>() }

const LEAD_HOA = {
    id: "l-1",
    contact_name: "Hoa",
    company: "Hoa Shop",
    need: "T-shirts",
    stage: "qualified",
    created_at: "2026-10-06T03:00:00.000Z",
}

const EMPTY_METRICS = { today: 0, waiting: 0, p50FirstResponseMin: null, sample: 0, leadsCaptured7d: 0 }

const EXPECTED_OVERVIEW = {
    workspaceId: "ws-1",
    nowIso: "2026-10-13T03:00:00.000Z",
    conversations: [
        {
            id: "c-3",
            channel: "zalo",
            name: "",
            leadId: "missing",
            lastText: "",
            lastRole: null,
            lastAt: "2026-10-13T02:00:00.000Z",
            messageCount: 0,
            handledBy: null,
            waiting: false,
            unanswered: false,
            lead: null,
            respondent: { kind: "ai", name: null },
        },
        {
            id: "c-2",
            channel: "zalo",
            name: "",
            leadId: null,
            lastText: "Hello",
            lastRole: "agent",
            lastAt: "2026-10-13T01:03:00.000Z",
            messageCount: 1,
            handledBy: null,
            waiting: false,
            unanswered: false,
            lead: null,
            respondent: { kind: "ai", name: null },
        },
        {
            id: "c-1",
            channel: "zalo",
            name: "Hoa",
            leadId: "l-1",
            lastText: "200k",
            lastRole: "agent",
            lastAt: "2026-10-13T01:02:00.000Z",
            messageCount: 4,
            handledBy: null,
            waiting: true,
            unanswered: false,
            lead: { stage: "qualified", need: "T-shirts", company: "Hoa Shop" },
            respondent: { kind: "ai", name: null },
        },
    ],
    metrics: { today: 2, waiting: 1, p50FirstResponseMin: 2, sample: 1, leadsCaptured7d: 1 },
    waiting: [
        {
            workItemId: "w-2",
            conversationId: "c-1",
            channel: "zalo",
            name: "Hoa",
            question: "Price?",
            draft: "Yes, 200k",
            staffName: "Mai",
            since: "2026-10-13T01:02:00.000Z",
        },
        {
            workItemId: "w-3",
            conversationId: "c-1",
            channel: "zalo",
            name: "Hoa",
            question: "",
            draft: "",
            staffName: null,
            since: "2026-10-13T01:02:00.000Z",
        },
    ],
}

describe("chatbot overview mapper", () => {
    it("returns the clock and zero figures for the empty snapshot", async () => {
        const subject = await buildSubject()

        expect(subject.emptyChatbotOverview("ws-1", NOW)).toEqual({
            workspaceId: "ws-1",
            nowIso: "2026-10-13T03:00:00.000Z",
            conversations: [],
            metrics: EMPTY_METRICS,
            waiting: [],
        })
        expect(
            subject.buildChatbotOverview({
                workspaceId: "ws-1",
                now: NOW,
                ...DESK,
                conversations: [],
                messages: [],
                waiting: [],
                leads: [],
            }),
        ).toEqual(subject.emptyChatbotOverview("ws-1", NOW))
    })

    it("sorts by latest activity, counts the Vietnam day and includes the seven-day lead boundary", async () => {
        const subject = await buildSubject()

        const result = subject.buildChatbotOverview({
            workspaceId: "ws-1",
            now: NOW,
            ...DESK,
            conversations: [
                conversationOf(),
                conversationOf({ id: "c-2", lead_id: null, created_at: "2026-10-12T16:59:59.999Z" }),
                conversationOf({ id: "c-3", lead_id: "missing", created_at: "2026-10-13T02:00:00.000Z" }),
            ],
            messages: [
                messageOf({ role: "agent", body: "Before the question", created_at: "2026-10-13T00:59:00.000Z" }),
                messageOf(),
                messageOf({ role: "system", body: "Assigned", created_at: "2026-10-13T01:00:30.000Z" }),
                messageOf({ role: "agent", body: "Same instant", created_at: "2026-10-13T01:00:00.000Z" }),
                messageOf({ role: "agent", body: "200k", created_at: "2026-10-13T01:02:00.000Z" }),
                messageOf({
                    conversation_id: "c-2",
                    role: "agent",
                    body: "Hello",
                    created_at: "2026-10-13T01:03:00.000Z",
                }),
            ],
            waiting: [
                waitingOf({ id: "w-1", subject_id: null }),
                waitingOf({
                    id: "w-2",
                    assigned_staff_id: "s-1",
                    proposal: {
                        summary: "Customer asks the price",
                        draft: "Yes, 200k",
                        fields: { conversation_id: "c-1", question: "Price?" },
                    },
                    subject_id: "c-2",
                }),
                waitingOf({ id: "w-3" }),
            ],
            leads: [LEAD_HOA, { ...LEAD_HOA, id: "old", contact_name: "Old", created_at: "2026-10-06T02:59:59.999Z" }],
            staffNames: new Map([["s-1", "Mai"]]),
        })

        expect(result).toEqual(EXPECTED_OVERVIEW)
    })
})

describe("chatbot overview mapper", () => {
    it("leaves response metrics empty when a user has no strictly later agent reply", async () => {
        const subject = await buildSubject()

        const result = subject.buildChatbotOverview({
            workspaceId: "ws-1",
            now: NOW,
            ...DESK,
            conversations: [conversationOf()],
            messages: [messageOf(), messageOf({ role: "agent" })],
            waiting: [],
            leads: [],
        })

        expect(result.metrics).toEqual({ ...EMPTY_METRICS, today: 1 })
    })

    it.each([
        { seconds: [400, 80, 160], expected: 2.67 },
        { seconds: [400, 80, 160, 240], expected: 3.33 },
    ])("sorts response durations and rounds the median for $seconds seconds", async ({ seconds, expected }) => {
        const subject = await buildSubject()

        const conversations = seconds.map((_, index) => conversationOf({ id: `c-${index}`, lead_id: null }))
        const messages = seconds.flatMap((delay, index) => [
            messageOf({ conversation_id: `c-${index}` }),
            messageOf({
                conversation_id: `c-${index}`,
                role: "agent",
                created_at: new Date(Date.parse("2026-10-13T01:00:00.000Z") + delay * 1_000),
            }),
        ])
        const result = subject.buildChatbotOverview({
            workspaceId: "ws-1",
            now: NOW,
            ...DESK,
            conversations,
            messages,
            waiting: [],
            leads: [],
        })

        expect(result.metrics).toEqual({
            ...EMPTY_METRICS,
            today: seconds.length,
            p50FirstResponseMin: expected,
            sample: seconds.length,
        })
    })
})

describe("chatbot overview mapper respondent", () => {
    it("tells the AI of the desk, a person who holds the chat and the other agent a hand-over moved it to", async () => {
        const subject = await buildSubject()

        const result = subject.buildChatbotOverview({
            workspaceId: "ws-1",
            now: NOW,
            ...DESK,
            agentNames: new Map([["agent-2", "Sales AI"]]),
            conversations: [
                conversationOf({ id: "c-ai", lead_id: null }),
                conversationOf({ id: "c-person", lead_id: null, handled_by: "Lan" }),
                conversationOf({ id: "c-agent", lead_id: null, agent_id: "agent-2", front_agent_id: "agent-1" }),
            ],
            messages: [],
            waiting: [],
            leads: [],
        })

        expect(Object.fromEntries(result.conversations.map((row) => [row.id, row.respondent]))).toEqual({
            "c-ai": { kind: "ai", name: null },
            "c-person": { kind: "person", name: "Lan" },
            "c-agent": { kind: "agent", name: "Sales AI" },
        })
    })

    it("lists a waiting reply only for a conversation in the list", async () => {
        const subject = await buildSubject()

        const result = subject.buildChatbotOverview({
            workspaceId: "ws-1",
            now: NOW,
            ...DESK,
            conversations: [conversationOf()],
            messages: [],
            waiting: [waitingOf({ id: "w-9", subject_id: "elsewhere" })],
            leads: [],
        })

        expect(result.waiting).toEqual([])
    })
})
