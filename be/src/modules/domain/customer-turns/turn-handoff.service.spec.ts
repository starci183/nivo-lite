import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { AgentConversationsService, AgentConversationsErrorCode } from "@modules/domain/agent-conversations"
import type { TurnConversation } from "@modules/domain/agent-conversations"
import type { ToolContext } from "@modules/domain/agent-tools"
import { AGENTS_INSTALLATIONS, AgentsService } from "@modules/domain/agents"
import type { AgentProfile, Installation, InstallationDirectory } from "@modules/domain/agents"
import { ConversationOwnershipEventsService } from "@modules/domain/conversation-ownership-events"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { HubNotesService } from "./hub-notes.service"
import { TurnHandoffService } from "./turn-handoff.service"
import { TurnSourcesService } from "./turn-sources.service"

const CTX: ToolContext = { jobId: "job-1", workspaceId: "ws", conversationId: "c1" }
const CARE_ID = "7d9f1c2e-1111-4222-8333-444455556666"
const CONVERSATION: TurnConversation = {
    id: "c1",
    workspaceId: "ws",
    channel: "zalo",
    externalId: "z1",
    connectionId: "conn",
    leadId: "l1",
    handledBy: null,
    visitorName: "Lan",
    installationId: "i1",
    agent: {
        id: "sales",
        name: "AI Sales",
        handle: "ai-sales",
        role: "",
        module: "chatbot",
        instructions: "",
        knowledge: "",
        approvalRule: "",
        greeting: "",
    },
}
const CARE: AgentProfile = {
    id: CARE_ID,
    name: "AI Care",
    handle: "ai-care",
    role: "",
    instructions: "",
    knowledge: "",
    approval_rule: "",
}
const CARE_INSTALLATION: Installation = {
    id: "i2",
    workspaceId: "ws",
    module: "care",
    name: "Care",
    isMulti: true,
    agentId: CARE_ID,
    operatingMode: "assist",
    settings: {},
    activeContextVersionId: null,
}
const NOTE = { to: "care", note: "booking confirmed" }
const PRICE_LIST = [{ layer: 2 as const, kind: "brain_document", ref: "src-1", label: "Price list" }]

const catalog = mock<MessageCatalog>({
    get: (key: string, params?: Readonly<Record<string, string | number>>) => `${key} ${JSON.stringify(params ?? {})}`,
})

const build = async () => {
    const tx = fakeTransaction(mockEntityManager())
    const installations = mock<InstallationDirectory>({ ofAgent: jest.fn().mockResolvedValue(CARE_INSTALLATION) })
    const conversations = mock<AgentConversationsService>({
        turnOf: jest.fn().mockResolvedValue({ kind: "ok", value: CONVERSATION }),
        handToAgent: jest.fn().mockResolvedValue(true),
        isTestChat: jest.fn().mockResolvedValue(false),
    })
    const agents = mock<AgentsService>({
        profileOf: jest.fn().mockResolvedValue(CARE),
        profileOfDepartment: jest.fn().mockResolvedValue(CARE),
    })
    const ownership = mock<ConversationOwnershipEventsService>({ record: jest.fn().mockResolvedValue(undefined) })
    const notes = mock<HubNotesService>({ post: jest.fn().mockResolvedValue(undefined) })
    const sources = mock<TurnSourcesService>({ of: jest.fn().mockReturnValue(PRICE_LIST) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            TurnHandoffService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: AGENTS_INSTALLATIONS, useValue: installations },
            { provide: AgentConversationsService, useValue: conversations },
            { provide: AgentsService, useValue: agents },
            { provide: ConversationOwnershipEventsService, useValue: ownership },
            { provide: HubNotesService, useValue: notes },
            { provide: TurnSourcesService, useValue: sources },
        ],
    }).compile()
    return {
        service: moduleRef.get(TurnHandoffService),
        tx,
        installations,
        conversations,
        agents,
        ownership,
        notes,
        sources,
    }
}

describe("TurnHandoffService moves", () => {
    it("hands the conversation to the department's agent and records it in one transaction, then notes both rooms", async () => {
        const { service, tx, agents, conversations, ownership, notes, sources } = await build()
        await expect(service.handOff(CTX, NOTE)).resolves.toEqual({ status: "handed_off", to: "AI Care" })
        expect(agents.profileOfDepartment).toHaveBeenCalledWith("ws", "care")
        const moved = conversations.handToAgent.mock.calls[0]?.[0]
        expect(moved).toMatchObject({ workspaceId: "ws", conversationId: "c1", agentId: CARE_ID, installationId: "i2" })
        expect(ownership.record.mock.calls[0]?.[0]).toMatchObject({
            workspaceId: "ws",
            conversationId: "c1",
            fromAgentId: "sales",
            toAgentId: CARE_ID,
            reason: "booking confirmed",
        })
        expect(ownership.record.mock.calls[0]?.[0].manager).toBe(moved?.manager)
        expect(tx.commits).toBe(1)
        expect(notes.post.mock.calls.map((call) => call[1])).toEqual(["sales", CARE_ID])
        expect(notes.post.mock.calls[0]?.[0]).toEqual({
            workspaceId: "ws",
            room: "",
            type: "handoff_note",
            title: 'gatewayTurns.cardHandoff {"name":"Lan","from":"AI Sales","to":"AI Care","why":"booking confirmed"}',
            fields: [],
            authorName: "AI Care",
            sources: PRICE_LIST,
        })
        expect(sources.of).toHaveBeenCalledWith("job-1")
        expect(notes.post.mock.calls[0]?.[2]).toEqual({ leadId: "l1", workItemId: null })
    })

    it("hands to an agent named by id, keeping the installation when the agent has none", async () => {
        const { service, agents, installations, conversations, notes } = await build()
        installations.ofAgent.mockResolvedValueOnce(null)
        await service.handOff(CTX, { to: CARE_ID, note: "x" })
        expect(agents.profileOf).toHaveBeenCalledWith("ws", CARE_ID)
        expect(conversations.handToAgent.mock.calls[0]?.[0].installationId).toBeNull()
        expect(notes.post.mock.calls[0]?.[0].title).toContain('"name":"Lan"')
    })

    it("names an unnamed customer as empty on the note", async () => {
        const { service, conversations, notes } = await build()
        conversations.turnOf.mockResolvedValueOnce({ kind: "ok", value: { ...CONVERSATION, visitorName: null } })
        await service.handOff(CTX, NOTE)
        expect(notes.post.mock.calls[0]?.[0].title).toContain('"name":""')
    })
})

describe("TurnHandoffService refusals", () => {
    it("answers not found for a missing conversation or one of another workspace", async () => {
        const { service, conversations, agents } = await build()
        conversations.turnOf.mockResolvedValueOnce({ kind: "refused", code: AgentConversationsErrorCode.NotFound })
        await expect(service.handOff(CTX, NOTE)).resolves.toEqual({ status: "not_found" })
        conversations.turnOf.mockResolvedValueOnce({ kind: "ok", value: { ...CONVERSATION, workspaceId: "other" } })
        await expect(service.handOff(CTX, NOTE)).resolves.toEqual({ status: "not_found" })
        expect(agents.profileOfDepartment).not.toHaveBeenCalled()
    })

    it("keeps a conversation a person holds, an unknown agent and the agent itself", async () => {
        const { service, conversations, agents } = await build()
        conversations.turnOf.mockResolvedValueOnce({ kind: "ok", value: { ...CONVERSATION, handledBy: "Mai" } })
        await expect(service.handOff(CTX, NOTE)).resolves.toEqual({ status: "held_by_person" })
        agents.profileOfDepartment.mockResolvedValueOnce(null)
        await expect(service.handOff(CTX, NOTE)).resolves.toEqual({ status: "no_such_agent" })
        agents.profileOfDepartment.mockResolvedValueOnce({ ...CARE, id: "sales" })
        await expect(service.handOff(CTX, NOTE)).resolves.toEqual({ status: "already_there" })
        expect(conversations.handToAgent).not.toHaveBeenCalled()
    })

    it("never moves an owner's test chat", async () => {
        const { service, conversations, agents } = await build()
        conversations.isTestChat.mockResolvedValueOnce(true)
        await expect(service.handOff(CTX, NOTE)).resolves.toEqual({ status: "simulation" })
        expect(conversations.isTestChat).toHaveBeenCalledWith("c1")
        expect(agents.profileOfDepartment).not.toHaveBeenCalled()
        expect(conversations.handToAgent).not.toHaveBeenCalled()
    })

    it("records nothing and notes nobody when the move did not apply", async () => {
        const { service, conversations, ownership, notes } = await build()
        conversations.handToAgent.mockResolvedValueOnce(false)
        await expect(service.handOff(CTX, NOTE)).resolves.toEqual({ status: "not_moved" })
        expect(ownership.record).not.toHaveBeenCalled()
        expect(notes.post).not.toHaveBeenCalled()
    })

    it("rolls the move back when the record fails, and posts no note", async () => {
        const { service, ownership, notes, tx } = await build()
        ownership.record.mockRejectedValueOnce(new Error("insert failed"))
        await expect(service.handOff(CTX, NOTE)).rejects.toThrow("insert failed")
        expect(tx.rollbacks).toBe(1)
        expect(notes.post).not.toHaveBeenCalled()
    })
})
