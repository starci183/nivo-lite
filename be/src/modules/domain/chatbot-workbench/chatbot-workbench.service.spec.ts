import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { AgentConversationsErrorCode, AgentConversationsReadService } from "@modules/domain/agent-conversations"
import { AgentMessagesReadService } from "@modules/domain/agent-messages"
import { AgentDirectoryService } from "@modules/domain/agents"
import type { AgentLens } from "@modules/domain/agents"
import { LeadAutomationReadService, LeadReadService } from "@modules/domain/leads"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { MODULE_CATALOG, MODULE_CATEGORIES, ModulesService } from "@modules/domain/modules"
import type { ModuleDefinition } from "@modules/domain/modules"
import { StaffDirectoryService } from "@modules/domain/staff"
import { WorkItemsActivityService } from "@modules/domain/work-items"
import { InstallationOperationsService } from "@modules/domain/module-installations"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { ChatbotWorkbenchService } from "./chatbot-workbench.service"
import type { ConversationRow, MessageBriefRow, MessageRow, WaitingRow } from "./persistence/chatbot-workbench.rows"
import {
    briefOf,
    conversationOf,
    GAP,
    MEMBER,
    messageOf,
    waitingOf,
} from "@tests/fixtures/builders/chatbot-workbench.builder"
import { LEAD_READ, LEAD_VIEW } from "@tests/fixtures/builders/chatbot-workbench-leads.builder"

const NOW = "2026-10-13T03:00:00.000Z"

/** What the owners behind the workbench answer in one scenario. */
interface Facts {
    readonly agentIds: ReadonlyArray<string>
    readonly installations: ReadonlyArray<{ readonly id: string; readonly agentId: string | null }>
    readonly conversations: ReadonlyArray<ConversationRow>
    readonly conversation: ConversationRow | null
    readonly briefs: ReadonlyArray<MessageBriefRow>
    readonly messages: ReadonlyArray<MessageRow>
    readonly waiting: ReadonlyArray<WaitingRow>
    readonly lenses: ReadonlyArray<AgentLens>
    readonly leadViews: ReadonlyArray<typeof LEAD_VIEW>
}

const build = async (facts: Partial<Facts> = {}) => {
    const clock = new FakeClock(NOW)
    const members = mock<WorkspaceMembersService>({ require: jest.fn(() => Promise.resolve(MEMBER)) })
    const knowledgeGaps = mock<KnowledgeGapsService>({ list: jest.fn(() => Promise.resolve([GAP])) })
    const modules = mock<ModulesService>({
        catalog: jest.fn(() => Promise.resolve({ categories: MODULE_CATEGORIES, modules: MODULE_CATALOG })),
    })
    const staff = mock<StaffDirectoryService>({
        namesOf: jest.fn(() => Promise.resolve([{ id: "st-1", name: "Minh" }])),
    })
    const work = mock<WorkItemsActivityService>()
    work.waitingReplies.mockResolvedValue([...(facts.waiting ?? [])])
    const installs = mock<InstallationOperationsService>()
    installs.agentLinksOf.mockResolvedValue([...(facts.installations ?? [])])
    const leads = mock<LeadReadService>()
    leads.listByIds.mockResolvedValue([...(facts.leadViews ?? [])])
    const leadFacts = mock<LeadAutomationReadService>()
    leadFacts.lead.mockResolvedValue(undefined)
    const agentDirectory = mock<AgentDirectoryService>()
    agentDirectory.idsOfModule.mockResolvedValue([...(facts.agentIds ?? [])])
    agentDirectory.activeLensesOf.mockResolvedValue([...(facts.lenses ?? [])])
    const conversationReads = mock<AgentConversationsReadService>()
    conversationReads.customerOfAgents.mockResolvedValue([...(facts.conversations ?? [])])
    conversationReads.customerById.mockResolvedValue(facts.conversation ?? null)
    const messageReads = mock<AgentMessagesReadService>()
    messageReads.briefsIn.mockResolvedValue([...(facts.briefs ?? [])])
    messageReads.threadOf.mockResolvedValue([...(facts.messages ?? [])])
    const moduleRef = await Test.createTestingModule({
        providers: [
            ChatbotWorkbenchService,
            { provide: LeadReadService, useValue: leads },
            { provide: LeadAutomationReadService, useValue: leadFacts },
            { provide: WorkItemsActivityService, useValue: work },
            { provide: InstallationOperationsService, useValue: installs },
            { provide: StaffDirectoryService, useValue: staff },
            { provide: AgentDirectoryService, useValue: agentDirectory },
            { provide: AgentConversationsReadService, useValue: conversationReads },
            { provide: AgentMessagesReadService, useValue: messageReads },
            { provide: CLOCK, useValue: clock },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: KnowledgeGapsService, useValue: knowledgeGaps },
            { provide: ModulesService, useValue: modules },
        ],
    }).compile()
    return {
        service: moduleRef.get(ChatbotWorkbenchService),
        members,
        knowledgeGaps,
        modules,
        staff,
        work,
        installs,
        leads,
        leadFacts,
        agentDirectory,
        conversationReads,
        messageReads,
    }
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
        const { service, members, leads, conversationReads, messageReads } = await build({
            agentIds: ["a-1"],
            conversations: [
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
            briefs: [
                briefOf(),
                briefOf({ id: "m-2", role: "agent", body: "Yes, it is", created_at: "2026-10-13T01:02:00.000Z" }),
                briefOf({
                    id: "m-3",
                    conversation_id: "c-2",
                    body: "How much is it?",
                    created_at: "2026-10-10T05:00:00.000Z",
                }),
            ],
            waiting: [waitingOf()],
            leadViews: [LEAD_VIEW],
        })

        await expect(service.overview("u-1", { workspaceId: "ws-1", installationId: null })).resolves.toEqual(
            EXPECTED_OVERVIEW,
        )
        expect(members.require).toHaveBeenCalledWith("u-1", "ws-1")
        expect(conversationReads.customerOfAgents).toHaveBeenCalledWith("ws-1", ["a-1"], 200)
        expect(messageReads.briefsIn).toHaveBeenCalledWith(
            "ws-1",
            ["c-2", "c-1"],
            new Date("2026-09-13T03:00:00.000Z"),
            6000,
        )
        expect(leads.listByIds).toHaveBeenCalledWith("ws-1", ["l-1"])
    })
})

describe("ChatbotWorkbenchService overview of installations", () => {
    it("answers an empty inbox when the selected installation is not in the workspace", async () => {
        const { service } = await build({ installations: [{ id: "i-1", agentId: "a-1" }] })

        await expect(service.overview("u-1", { workspaceId: "ws-1", installationId: "i-9" })).resolves.toEqual({
            workspaceId: "ws-1",
            nowIso: NOW,
            conversations: [],
            metrics: EMPTY_METRICS,
        })
    })

    it("reads no leads when no conversation of the inbox has one", async () => {
        const { service, leads } = await build({
            agentIds: ["a-1"],
            conversations: [conversationOf({ lead_id: null })],
        })

        const view = await service.overview("u-1", { workspaceId: "ws-1", installationId: null })

        expect(view.conversations.map((row) => row.id)).toEqual(["c-1"])
        expect(leads.listByIds).toHaveBeenCalledWith("ws-1", [])
    })

    it("reads only the installation's own agent when the workspace has several", async () => {
        const { service, conversationReads } = await build({
            installations: [
                { id: "i-1", agentId: "a-1" },
                { id: "i-2", agentId: "a-2" },
            ],
        })

        const overview = await service.overview("u-1", { workspaceId: "ws-1", installationId: "i-2" })

        expect(overview.conversations).toEqual([])
        expect(conversationReads.customerOfAgents).toHaveBeenCalledWith("ws-1", ["a-2"], 200)
    })

    it("answers an empty inbox for one of several installations without an agent", async () => {
        const { service } = await build({
            installations: [
                { id: "i-1", agentId: null },
                { id: "i-2", agentId: "a-2" },
            ],
        })

        const overview = await service.overview("u-1", { workspaceId: "ws-1", installationId: "i-1" })

        expect(overview.metrics).toEqual(EMPTY_METRICS)
    })

    it("combines the legacy agents for a single installation", async () => {
        const { service, conversationReads, agentDirectory } = await build({
            installations: [{ id: "i-1", agentId: "a-1" }],
            agentIds: ["a-1", "a-0"],
        })

        const overview = await service.overview("u-1", { workspaceId: "ws-1", installationId: "i-1" })

        expect(overview.conversations).toEqual([])
        expect(agentDirectory.idsOfModule).toHaveBeenCalledWith("ws-1", "chatbot", 100)
        expect(conversationReads.customerOfAgents).toHaveBeenCalledWith("ws-1", ["a-1", "a-0"], 200)
    })
})

describe("ChatbotWorkbenchService thread", () => {
    it("answers the thread with its lead and the escalation assigned to a staff member", async () => {
        const { service, staff, leadFacts, messageReads } = await build({
            conversation: conversationOf({ handled_at: "2026-10-13T02:30:00.000Z" }),
            messages: [
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
            waiting: [
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
        })
        leadFacts.lead.mockResolvedValue(LEAD_READ)

        await expect(service.thread("u-1", "ws-1", "c-1")).resolves.toEqual(EXPECTED_THREAD)
        expect(messageReads.threadOf).toHaveBeenCalledWith("ws-1", "c-1", 500)
        expect(leadFacts.lead).toHaveBeenCalledWith("ws-1", "l-1")
        expect(staff.namesOf).toHaveBeenCalledWith("ws-1", ["st-1"])
    })

    it("answers a thread without lead or escalation without reading staff", async () => {
        const { service, staff, leadFacts } = await build({
            conversation: conversationOf({ lead_id: null, visitor_name: "Minh" }),
            waiting: [waitingOf()],
        })

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
        expect(leadFacts.lead).not.toHaveBeenCalled()
    })

    it("refuses a conversation of another workspace", async () => {
        const { service, messageReads } = await build()

        await expect(service.thread("u-1", "ws-1", "c-9")).rejects.toMatchObject({
            code: AgentConversationsErrorCode.NotFound,
        })
        expect(messageReads.threadOf).not.toHaveBeenCalled()
    })
})

describe("ChatbotWorkbenchService gaps", () => {
    it.each([{ key: "chatbot" }, { key: "chatbot", audience: undefined }, { key: "chatbot", audience: null }])(
        "defaults a catalog lens with a missing or nullish audience to internal: %p",
        async (definition) => {
            const { service, modules } = await build({ lenses: [{ module: "chatbot", name: "Mai" }] })
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
        const { service, members, knowledgeGaps, agentDirectory } = await build({
            lenses: [
                { module: "chatbot", name: "Mai" },
                { module: "chatbot", name: "Mai 2" },
                { module: "retired", name: "Old" },
                { module: "sales", name: "Nam" },
            ],
        })

        await expect(service.gaps("u-1", "ws-1")).resolves.toEqual({
            gaps: [GAP],
            lenses: [
                { module: "chatbot", name: "Mai", audience: "customer" },
                { module: "sales", name: "Nam", audience: "internal" },
            ],
        })
        expect(members.require).toHaveBeenCalledWith("u-1", "ws-1", ["owner", "manager"])
        expect(knowledgeGaps.list).toHaveBeenCalledWith("ws-1", ["open"], 50)
        expect(agentDirectory.activeLensesOf).toHaveBeenCalledWith("ws-1", 100)
    })

    it("stops before reading when the caller is not an owner or manager", async () => {
        const { service, members, knowledgeGaps } = await build()
        const refused = new Error("WORKSPACE_MEMBERS_FORBIDDEN")
        members.require.mockRejectedValue(refused)

        await expect(service.gaps("u-1", "ws-1")).rejects.toBe(refused)
        expect(knowledgeGaps.list).not.toHaveBeenCalled()
    })

    it("preserves the gaps when every active agent belongs to a retired module", async () => {
        const { service } = await build({
            lenses: [
                { module: "retired", name: "Old" },
                { module: "retired", name: "Old duplicate" },
            ],
        })

        await expect(service.gaps("u-1", "ws-1")).resolves.toEqual({ gaps: [GAP], lenses: [] })
    })
})
