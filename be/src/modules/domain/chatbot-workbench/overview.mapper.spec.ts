import type * as SubjectModule from "./overview.mapper"
import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import { buildChatbotOverview, emptyChatbotOverview } from "./overview.mapper"
import type { ConversationRow, MessageBriefRow, WaitingRow } from "./persistence/chatbot-workbench.rows"

const SUBJECT = Symbol("overview.mapper")
type Subject = Pick<typeof SubjectModule, "emptyChatbotOverview" | "buildChatbotOverview">

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { emptyChatbotOverview, buildChatbotOverview } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const NOW = Date.parse("2026-10-13T03:00:00.000Z")
const conversationOf = builder<ConversationRow>({
    id: "c-1",
    channel: "zalo",
    visitor_name: null,
    lead_id: "l-1",
    handled_by: null,
    handled_at: null,
    external_id: "zalo-9",
    created_at: "2026-10-12T17:00:00.000Z",
})

const messageOf = builder<MessageBriefRow>({
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
        },
    ],
    metrics: { today: 2, waiting: 1, p50FirstResponseMin: 2, sample: 1, leadsCaptured7d: 1 },
}

describe("chatbot overview mapper", () => {
    it("returns the clock and zero figures for the empty snapshot", async () => {
        const subject = await buildSubject()

        expect(subject.emptyChatbotOverview("ws-1", NOW)).toEqual({
            workspaceId: "ws-1",
            nowIso: "2026-10-13T03:00:00.000Z",
            conversations: [],
            metrics: EMPTY_METRICS,
        })
        expect(
            subject.buildChatbotOverview({
                workspaceId: "ws-1",
                now: NOW,
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
                waitingOf({ subject_id: null }),
                waitingOf({ proposal: { fields: { conversation_id: "c-1" } }, subject_id: "c-2" }),
                waitingOf(),
            ],
            leads: [
                { id: "l-1", contact_name: "Hoa", created_at: "2026-10-06T03:00:00.000Z" },
                { id: "old", contact_name: "Old", created_at: "2026-10-06T02:59:59.999Z" },
            ],
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
