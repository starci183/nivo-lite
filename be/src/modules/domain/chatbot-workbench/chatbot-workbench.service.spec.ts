import { Test } from "@nestjs/testing"
import { FakeClock, builder, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { AgentConversationsErrorCode } from "@modules/domain/agent-conversations"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import type { GapRecord } from "@modules/domain/knowledge-gaps"
import { MODULE_CATALOG, MODULE_CATEGORIES, ModulesService } from "@modules/domain/modules"
import type { ModuleDefinition } from "@modules/domain/modules"
import { StaffDirectoryService } from "@modules/domain/staff"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ChatbotWorkbenchService } from "./chatbot-workbench.service"
import type {
    ConversationRow,
    LeadBriefRow,
    LeadRow,
    MessageBriefRow,
    MessageRow,
    WaitingRow,
} from "./persistence/chatbot-workbench.rows"
import { answerByTable } from "@tests/fixtures/builders/table-query-builder.builder"
import type { TableAnswers } from "@tests/fixtures/builders/table-query-builder.builder"

/** The table each read of the capability asks, so a spec names the read it answers. */
const FIND_CHATBOT_CONVERSATION = "public.agent_conversations"
const LIST_CHATBOT_CONVERSATIONS = "public.agent_conversations"
const LIST_CHATBOT_MESSAGE_BRIEFS = "public.agent_messages"
const LIST_CHATBOT_MESSAGES = "public.agent_messages"
const LIST_CHATBOT_WAITING = "public.work_items"
const LIST_CHATBOT_LEAD_BRIEFS = "public.leads"
const LIST_CHATBOT_INSTALLATIONS = "public.module_installations"
const LIST_CHATBOT_AGENTS = "public.agents"

type TableStub = readonly [string, ReadonlyArray<unknown>]

const SEEN = new WeakMap<object, TableAnswers>()

const isPair = (value: TableStub | ReadonlyArray<TableStub>): value is TableStub => typeof value[0] === "string"

/** A manager whose tables answer the given rows; `query` names them as a pair or a list of pairs. */
const tablesEm = (stubs: { readonly query?: TableStub | ReadonlyArray<TableStub> } = {}) => {
    const em = mockEntityManager()
    const given = stubs.query ?? []
    const pairs: ReadonlyArray<TableStub> = isPair(given) ? [given] : given
    SEEN.set(em, answerByTable(em, Object.fromEntries(pairs)))
    return { em }
}

/** The named parameters of every condition the subject put on its n-th read of a table. */
const parametersOf = (em: object, table: string, nth = 0): unknown =>
    Object.assign(
        {},
        ...(SEEN.get(em)?.queriesOf(table)[nth]?.calls ?? [])
            .filter((call) => call.method === "where" || call.method === "andWhere")
            .map((call) => call.args[1]),
    )

const NOW = "2026-10-13T03:00:00.000Z"

const MEMBER: WorkspaceMember = {
    userId: "u-1",
    workspaceId: "ws-1",
    role: "owner",
    staffId: null,
    displayName: "Lan",
    status: "active",
}

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

const briefOf = builder<MessageBriefRow>({
    id: "m-1",
    conversation_id: "c-1",
    role: "user",
    body: "Is it in stock?",
    created_at: "2026-10-13T01:00:00.000Z",
})

const messageOf = builder<MessageRow>({
    ...briefOf(),
    author_kind: null,
    author_name: null,
    delivery_status: null,
    delivery_error: null,
})

const waitingOf = builder<WaitingRow>({
    id: "w-1",
    subject_id: "c-2",
    proposal: null,
    assigned_staff_id: null,
    created_at: "2026-10-13T02:00:00.000Z",
})

const LEAD_BRIEF: LeadBriefRow = { id: "l-1", contact_name: "Hoa", created_at: "2026-10-12T00:00:00.000Z" }

const LEAD: LeadRow = {
    id: "l-1",
    contact_name: "Hoa",
    company: "Hoa Shop",
    stage: "new",
    need: "T-shirts",
    phone: "0901000000",
    email: null,
}

const GAP: GapRecord = {
    id: "g-1",
    module: "chatbot",
    question: "When does the shop open?",
    topic: null,
    attributeGuess: null,
    count: 3,
    firstSeenAt: "2026-10-01T00:00:00.000Z",
    lastSeenAt: "2026-10-12T00:00:00.000Z",
    exampleConversationId: "c-1",
    status: "open",
    reopenedCount: 0,
}

const build = async (em: MockEntityManager) => {
    const clock = new FakeClock(NOW)
    const members = mock<WorkspaceMembersService>({ require: jest.fn(() => Promise.resolve(MEMBER)) })
    const knowledgeGaps = mock<KnowledgeGapsService>({ list: jest.fn(() => Promise.resolve([GAP])) })
    const modules = mock<ModulesService>({
        catalog: jest.fn(() => Promise.resolve({ categories: MODULE_CATEGORIES, modules: MODULE_CATALOG })),
    })
    const staff = mock<StaffDirectoryService>({
        namesOf: jest.fn(() => Promise.resolve([{ id: "st-1", name: "Minh" }])),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChatbotWorkbenchService,
            { provide: StaffDirectoryService, useValue: staff },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: clock },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: KnowledgeGapsService, useValue: knowledgeGaps },
            { provide: ModulesService, useValue: modules },
        ],
    }).compile()
    return { service: moduleRef.get(ChatbotWorkbenchService), members, knowledgeGaps, modules, staff }
}

const EMPTY_METRICS = { today: 0, waiting: 0, p50FirstResponseMin: null, sample: 0, leadsCaptured7d: 0 }

const EXPECTED_OVERVIEW = {
    workspaceId: "ws-1",
    nowIso: NOW,
    conversations: [
        {
            id: "c-1",
            channel: "zalo",
            name: "Hoa",
            leadId: "l-1",
            lastText: "Yes, it is",
            lastRole: "agent",
            lastAt: "2026-10-13T01:02:00.000Z",
            messageCount: 2,
            handledBy: null,
            waiting: false,
            unanswered: false,
        },
        {
            id: "c-2",
            channel: "website",
            name: "Minh",
            leadId: null,
            lastText: "How much is it?",
            lastRole: "user",
            lastAt: "2026-10-10T05:00:00.000Z",
            messageCount: 1,
            handledBy: "s-1",
            waiting: true,
            unanswered: true,
        },
    ],
    metrics: { today: 1, waiting: 1, p50FirstResponseMin: 2, sample: 1, leadsCaptured7d: 1 },
}

const EXPECTED_THREAD = {
    conversation: {
        id: "c-1",
        channel: "zalo",
        name: "Hoa",
        leadId: "l-1",
        lastText: "Yes, it is",
        lastRole: "agent",
        lastAt: "2026-10-13T01:02:00.000Z",
        messageCount: 2,
        handledBy: null,
        waiting: true,
        unanswered: false,
    },
    messages: [
        {
            id: "m-1",
            role: "user",
            authorKind: "ai",
            authorName: null,
            body: "Is it in stock?",
            createdAt: "2026-10-13T01:00:00.000Z",
            delivery: null,
            deliveryError: null,
        },
        {
            id: "m-2",
            role: "agent",
            authorKind: "human",
            authorName: "Lan",
            body: "Yes, it is",
            createdAt: "2026-10-13T01:02:00.000Z",
            delivery: "sent",
            deliveryError: null,
        },
    ],
    lead: {
        id: "l-1",
        name: "Hoa",
        company: "Hoa Shop",
        stage: "new",
        need: "T-shirts",
        phone: "0901000000",
        email: null,
    },
    escalation: {
        workItemId: "w-1",
        question: "How much is it?",
        draft: "It costs 200k",
        staffName: "Minh",
        since: "2026-10-13T02:00:00.000Z",
    },
    externalId: "zalo-9",
    handledAt: "2026-10-13T02:30:00.000Z",
}

describe("ChatbotWorkbenchService overview", () => {
    it("lists every Chatbot conversation newest first with today's response figures", async () => {
        const { em } = tablesEm({
            query: [
                [LIST_CHATBOT_AGENTS, [{ id: "a-1" }]],
                [
                    LIST_CHATBOT_CONVERSATIONS,
                    [
                        conversationOf({
                            id: "c-2",
                            channel: "webchat",
                            visitor_name: "Minh",
                            lead_id: null,
                            handled_by: "s-1",
                            created_at: "2026-10-10T05:00:00.000Z",
                        }),
                        conversationOf(),
                    ],
                ],
                [
                    LIST_CHATBOT_MESSAGE_BRIEFS,
                    [
                        briefOf(),
                        briefOf({
                            id: "m-2",
                            role: "agent",
                            body: "Yes, it is",
                            created_at: "2026-10-13T01:02:00.000Z",
                        }),
                        briefOf({
                            id: "m-3",
                            conversation_id: "c-2",
                            body: "How much is it?",
                            created_at: "2026-10-10T05:00:00.000Z",
                        }),
                    ],
                ],
                [LIST_CHATBOT_WAITING, [waitingOf()]],
                [LIST_CHATBOT_LEAD_BRIEFS, [LEAD_BRIEF]],
            ],
        })
        const { service, members } = await build(em)

        await expect(service.overview("u-1", { workspaceId: "ws-1", installationId: null })).resolves.toEqual(
            EXPECTED_OVERVIEW,
        )
        expect(members.require).toHaveBeenCalledWith("u-1", "ws-1")
        expect(parametersOf(em, LIST_CHATBOT_CONVERSATIONS)).toEqual({ workspaceId: "ws-1", agents: ["a-1"] })
        expect(parametersOf(em, LIST_CHATBOT_MESSAGE_BRIEFS)).toEqual({
            workspaceId: "ws-1",
            ids: ["c-2", "c-1"],
            since: new Date("2026-09-13T03:00:00.000Z"),
        })
        expect(parametersOf(em, LIST_CHATBOT_LEAD_BRIEFS)).toEqual({ workspaceId: "ws-1", leadIds: ["l-1"] })
    })
})

describe("ChatbotWorkbenchService overview", () => {
    it("answers an empty inbox when the selected installation is not in the workspace", async () => {
        const { em } = tablesEm({ query: [LIST_CHATBOT_INSTALLATIONS, [{ id: "i-1", agent_id: "a-1" }]] })
        const { service } = await build(em)

        await expect(service.overview("u-1", { workspaceId: "ws-1", installationId: "i-9" })).resolves.toEqual({
            workspaceId: "ws-1",
            nowIso: NOW,
            conversations: [],
            metrics: EMPTY_METRICS,
        })
    })

    it("reads no leads when no conversation of the inbox has one", async () => {
        const { em } = tablesEm({
            query: [
                [LIST_CHATBOT_AGENTS, [{ id: "a-1" }]],
                [LIST_CHATBOT_CONVERSATIONS, [conversationOf({ lead_id: null })]],
            ],
        })
        const { service } = await build(em)

        const view = await service.overview("u-1", { workspaceId: "ws-1", installationId: null })

        expect(view.conversations.map((row) => row.id)).toEqual(["c-1"])
        expect(SEEN.get(em)?.queriesOf(LIST_CHATBOT_LEAD_BRIEFS)).toEqual([])
    })

    it("reads only the installation's own agent when the workspace has several", async () => {
        const { em } = tablesEm({
            query: [
                [
                    LIST_CHATBOT_INSTALLATIONS,
                    [
                        { id: "i-1", agent_id: "a-1" },
                        { id: "i-2", agent_id: "a-2" },
                    ],
                ],
                [LIST_CHATBOT_CONVERSATIONS, []],
            ],
        })
        const { service } = await build(em)

        const overview = await service.overview("u-1", { workspaceId: "ws-1", installationId: "i-2" })

        expect(overview.conversations).toEqual([])
        expect(parametersOf(em, LIST_CHATBOT_CONVERSATIONS)).toEqual({ workspaceId: "ws-1", agents: ["a-2"] })
    })

    it("answers an empty inbox for one of several installations without an agent", async () => {
        const { em } = tablesEm({
            query: [
                LIST_CHATBOT_INSTALLATIONS,
                [
                    { id: "i-1", agent_id: null },
                    { id: "i-2", agent_id: "a-2" },
                ],
            ],
        })
        const { service } = await build(em)

        const overview = await service.overview("u-1", { workspaceId: "ws-1", installationId: "i-1" })

        expect(overview.metrics).toEqual(EMPTY_METRICS)
    })
})

describe("ChatbotWorkbenchService overview", () => {
    it("combines the legacy agents for a single installation", async () => {
        const { em } = tablesEm({
            query: [
                [LIST_CHATBOT_INSTALLATIONS, [{ id: "i-1", agent_id: "a-1" }]],
                [LIST_CHATBOT_AGENTS, [{ id: "a-1" }, { id: "a-0" }]],
                [LIST_CHATBOT_CONVERSATIONS, []],
            ],
        })
        const { service } = await build(em)

        const overview = await service.overview("u-1", { workspaceId: "ws-1", installationId: "i-1" })

        expect(overview.conversations).toEqual([])
        expect(parametersOf(em, LIST_CHATBOT_CONVERSATIONS)).toEqual({ workspaceId: "ws-1", agents: ["a-1", "a-0"] })
    })
})

describe("ChatbotWorkbenchService thread", () => {
    it("answers the thread with its lead and the escalation assigned to a staff member", async () => {
        const { em } = tablesEm({
            query: [
                [FIND_CHATBOT_CONVERSATION, [conversationOf({ handled_at: "2026-10-13T02:30:00.000Z" })]],
                [
                    LIST_CHATBOT_MESSAGES,
                    [
                        messageOf(),
                        messageOf({
                            id: "m-2",
                            role: "agent",
                            body: "Yes, it is",
                            author_kind: "human",
                            author_name: "Lan",
                            delivery_status: "sent",
                            created_at: "2026-10-13T01:02:00.000Z",
                        }),
                    ],
                ],
                [
                    LIST_CHATBOT_WAITING,
                    [
                        waitingOf({
                            subject_id: null,
                            assigned_staff_id: "st-1",
                            proposal: {
                                summary: "Price question",
                                draft: "It costs 200k",
                                fields: { conversation_id: "c-1", question: "How much is it?" },
                            },
                        }),
                    ],
                ],
                [LIST_CHATBOT_LEAD_BRIEFS, [LEAD]],
            ],
        })
        const { service, staff } = await build(em)

        await expect(service.thread("u-1", "ws-1", "c-1")).resolves.toEqual(EXPECTED_THREAD)
        expect(staff.namesOf).toHaveBeenCalledWith("ws-1", ["st-1"])
    })
})

describe("ChatbotWorkbenchService thread", () => {
    it("answers a thread without lead or escalation without reading staff", async () => {
        const { em } = tablesEm({
            query: [
                [FIND_CHATBOT_CONVERSATION, [conversationOf({ lead_id: null, visitor_name: "Minh" })]],
                [LIST_CHATBOT_MESSAGES, []],
                [LIST_CHATBOT_WAITING, [waitingOf()]],
                [LIST_CHATBOT_LEAD_BRIEFS, []],
            ],
        })
        const { service, staff } = await build(em)

        const thread = await service.thread("u-1", "ws-1", "c-1")

        expect(staff.namesOf).not.toHaveBeenCalled()
        expect(thread.lead).toBeNull()
        expect(thread.escalation).toBeNull()
        expect(thread.handledAt).toBeNull()
        expect(thread.conversation).toMatchObject({
            name: "Minh",
            lastAt: "2026-10-13T01:00:00.000Z",
            lastRole: null,
        })
        expect(parametersOf(em, LIST_CHATBOT_LEAD_BRIEFS)).toEqual({ workspaceId: "ws-1", leadId: null })
    })

    it("refuses a conversation of another workspace", async () => {
        const { em } = tablesEm({ query: [FIND_CHATBOT_CONVERSATION, []] })
        const { service } = await build(em)

        await expect(service.thread("u-1", "ws-1", "c-9")).rejects.toMatchObject({
            code: AgentConversationsErrorCode.NotFound,
        })
        expect(SEEN.get(em)?.queries).toHaveLength(1)
    })
})

describe("ChatbotWorkbenchService gaps", () => {
    it.each([{ key: "chatbot" }, { key: "chatbot", audience: undefined }, { key: "chatbot", audience: null }])(
        "defaults a catalog lens with a missing or nullish audience to internal: %p",
        async (definition) => {
            const { em } = tablesEm({ query: [LIST_CHATBOT_AGENTS, [{ module: "chatbot", name: "Mai" }]] })
            const { service, modules } = await build(em)
            const module = Object.assign({ ...mock<ModuleDefinition>({ key: "chatbot" }) }, definition)
            modules.catalog.mockResolvedValue({
                categories: MODULE_CATEGORIES,
                modules: [module],
            })

            await expect(service.gaps("u-1", "ws-1")).resolves.toEqual({
                gaps: [GAP],
                lenses: [{ module: "chatbot", name: "Mai", audience: "internal" }],
            })
        },
    )

    it("answers the open gaps and one lens per known module", async () => {
        const { em } = tablesEm({
            query: [
                LIST_CHATBOT_AGENTS,
                [
                    { module: "chatbot", name: "Mai" },
                    { module: "chatbot", name: "Mai 2" },
                    { module: "retired", name: "Old" },
                    { module: "sales", name: "Nam" },
                ],
            ],
        })
        const { service, members, knowledgeGaps } = await build(em)

        await expect(service.gaps("u-1", "ws-1")).resolves.toEqual({
            gaps: [GAP],
            lenses: [
                { module: "chatbot", name: "Mai", audience: "customer" },
                { module: "sales", name: "Nam", audience: "internal" },
            ],
        })
        expect(members.require).toHaveBeenCalledWith("u-1", "ws-1", ["owner", "manager"])
        expect(knowledgeGaps.list).toHaveBeenCalledWith("ws-1", ["open"], 50)
    })

    it("stops before reading when the caller is not an owner or manager", async () => {
        const em = mockEntityManager()
        const { service, members, knowledgeGaps } = await build(em)
        const refused = new Error("WORKSPACE_MEMBERS_FORBIDDEN")
        members.require.mockRejectedValue(refused)

        await expect(service.gaps("u-1", "ws-1")).rejects.toBe(refused)
        expect(knowledgeGaps.list).not.toHaveBeenCalled()
    })

    it("preserves the gaps when every active agent belongs to a retired module", async () => {
        const { em } = tablesEm({
            query: [
                LIST_CHATBOT_AGENTS,
                [
                    { module: "retired", name: "Old" },
                    { module: "retired", name: "Old duplicate" },
                ],
            ],
        })
        const { service, members, knowledgeGaps } = await build(em)

        await expect(service.gaps("u-1", "ws-1")).resolves.toEqual({ gaps: [GAP], lenses: [] })

        expect(members.require.mock.calls).toEqual([["u-1", "ws-1", ["owner", "manager"]]])
        expect(knowledgeGaps.list.mock.calls).toEqual([["ws-1", ["open"], 50]])
        expect(SEEN.get(em)?.queries.map((query) => query.table)).toEqual([LIST_CHATBOT_AGENTS])
        expect(parametersOf(em, LIST_CHATBOT_AGENTS)).toEqual({ workspaceId: "ws-1" })
    })
})
