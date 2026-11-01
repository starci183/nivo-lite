import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import {
    AgentConversationsService,
    AgentConversationsErrorCode,
    ConversationHandoverService,
} from "@modules/domain/agent-conversations"
import type { TurnConversation } from "@modules/domain/agent-conversations"
import type { ToolContext } from "@modules/domain/agent-tools"
import { AgentsService } from "@modules/domain/agents"
import type { AgentProfile } from "@modules/domain/agents"
import type { GraphAnswer } from "@modules/domain/authority-rules"
import { WorkEngineService } from "@modules/domain/decisions"
import { itemOf } from "@tests/fixtures/builders/work-engine.builder"
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
    speaksAs: null,
}
const CARE: AgentProfile = {
    id: CARE_ID,
    name: "AI Care",
    handle: "ai-care",
    role: "",
    instructions: "",
    knowledge: "",
    approval_rule: "",
    module: "chatbot",
}
const NOTE = { to: "care", note: "booking confirmed" }
const PRICE_LIST = [{ layer: 2 as const, kind: "brain_document", ref: "src-1", label: "Price list" }]

const catalog = mock<MessageCatalog>({
    get: (key: string, params?: Readonly<Record<string, string | number>>) => `${key} ${JSON.stringify(params ?? {})}`,
})

const RUN: GraphAnswer = { outcome: "run", unread: [], unjudged: null, divert: null }

const build = async () => {
    const conversations = mock<AgentConversationsService>({
        turnOf: jest.fn().mockResolvedValue({ kind: "ok", value: CONVERSATION }),
        isTestChat: jest.fn().mockResolvedValue(false),
    })
    const handover = mock<ConversationHandoverService>({ handOver: jest.fn().mockResolvedValue(true) })
    const agents = mock<AgentsService>({ profileByReference: jest.fn().mockResolvedValue(CARE) })
    const engine = mock<WorkEngineService>({
        checkGraph: jest.fn().mockResolvedValue(RUN),
        runDiverted: jest.fn().mockResolvedValue(itemOf({ id: "item-7" })),
    })
    const notes = mock<HubNotesService>({ post: jest.fn().mockResolvedValue(undefined) })
    const sources = mock<TurnSourcesService>({ of: jest.fn().mockReturnValue(PRICE_LIST) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            TurnHandoffService,
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: AgentConversationsService, useValue: conversations },
            { provide: ConversationHandoverService, useValue: handover },
            { provide: AgentsService, useValue: agents },
            { provide: HubNotesService, useValue: notes },
            { provide: TurnSourcesService, useValue: sources },
            { provide: WorkEngineService, useValue: engine },
        ],
    }).compile()
    return { service: moduleRef.get(TurnHandoffService), conversations, handover, agents, notes, sources, engine }
}

describe("TurnHandoffService moves", () => {
    it("hands the conversation to the department's agent through the one hand-over door, then notes both rooms", async () => {
        const { service, agents, handover, notes, sources } = await build()
        await expect(service.handOff(CTX, NOTE)).resolves.toEqual({ status: "handed_off", to: "AI Care" })
        expect(agents.profileByReference).toHaveBeenCalledWith("ws", "care")
        expect(handover.handOver).toHaveBeenCalledWith({
            workspaceId: "ws",
            conversationId: "c1",
            fromAgentId: "sales",
            toAgentId: CARE_ID,
            reason: "booking confirmed",
        })
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

    it("hands to an agent named by id", async () => {
        const { service, agents, handover, notes } = await build()
        await service.handOff(CTX, { to: CARE_ID, note: "x" })
        expect(agents.profileByReference).toHaveBeenCalledWith("ws", CARE_ID)
        expect(handover.handOver).toHaveBeenCalledWith(expect.objectContaining({ toAgentId: CARE_ID }))
        expect(notes.post.mock.calls[0]?.[0].title).toContain('"name":"Lan"')
    })

    it("names an unnamed customer as empty on the note", async () => {
        const { service, conversations, notes } = await build()
        conversations.turnOf.mockResolvedValueOnce({ kind: "ok", value: { ...CONVERSATION, visitorName: null } })
        await service.handOff(CTX, NOTE)
        expect(notes.post.mock.calls[0]?.[0].title).toContain('"name":""')
    })
})

const REQUEST = {
    workspaceId: "ws",
    installationId: "i1",
    action: "hand_over_conversation",
    road: "handover",
    key: "job-1:c1:7d9f1c2e-1111-4222-8333-444455556666",
    subjectType: "conversation",
    subjectId: "c1",
    leadId: "l1",
    text: null,
    money: null,
    attributes: { "handover.to": "chatbot" },
    turnId: null,
    wakeId: null,
    askOpensWork: true,
}

describe("TurnHandoffService the graph of the agent", () => {
    it("asks the graph about the move before it moves anything, and moves when the graph lets it run", async () => {
        const { service, engine, handover } = await build()

        await expect(service.handOff(CTX, NOTE)).resolves.toEqual({ status: "handed_off", to: "AI Care" })

        expect(engine.checkGraph).toHaveBeenCalledWith(REQUEST)
        expect(engine.runDiverted).not.toHaveBeenCalled()
        expect(handover.handOver).toHaveBeenCalledTimes(1)
    })

    it("moves nothing and starts nothing when the graph stops the move", async () => {
        const { service, engine, handover, notes } = await build()
        engine.checkGraph.mockResolvedValue({ outcome: "stop", unread: [], unjudged: null, divert: null })

        await expect(service.handOff(CTX, NOTE)).resolves.toEqual({ status: "stopped_by_graph" })

        expect(engine.runDiverted).not.toHaveBeenCalled()
        expect(handover.handOver).not.toHaveBeenCalled()
        expect(notes.post).not.toHaveBeenCalled()
    })
})

describe("TurnHandoffService the graph holds or redirects the move", () => {
    it("holds the move for a person when the graph asks: a waiting hand-over item that keeps the target and the note", async () => {
        const { service, engine, handover } = await build()
        engine.checkGraph.mockResolvedValue({ outcome: "ask", unread: [], unjudged: null, divert: null })

        await expect(service.handOff(CTX, NOTE)).resolves.toEqual({
            status: "approval_requested",
            work_item_id: "item-7",
        })

        expect(engine.runDiverted).toHaveBeenCalledWith(
            { workspaceId: "ws", actor: "OpenClaw", locale: "vi" },
            { action: "hand_over_conversation", handoverTo: CARE_ID, asks: true },
            {
                key: "job-1:c1",
                subjectType: "conversation",
                subjectId: "c1",
                leadId: "l1",
                installationId: "i1",
                origin: null,
                proposal: {
                    summary: 'gatewayTurns.handOverSummary {"to":"AI Care"}',
                    fields: { to: CARE_ID, note: "booking confirmed" },
                },
            },
        )
        expect(handover.handOver).not.toHaveBeenCalled()
    })

    it("runs the action the graph leads to instead, and does not move the conversation itself", async () => {
        const { service, engine, handover } = await build()
        const divert = { action: "hand_over_conversation", handoverTo: "support", asks: false }
        engine.checkGraph.mockResolvedValue({ outcome: "divert", unread: [], unjudged: null, divert })

        await expect(service.handOff(CTX, NOTE)).resolves.toEqual({
            status: "diverted_by_graph",
            work_item_id: "item-7",
        })

        expect(engine.runDiverted).toHaveBeenCalledWith(expect.anything(), divert, expect.anything())
        expect(handover.handOver).not.toHaveBeenCalled()
    })

    it("asks nothing of the graph for a conversation that cannot move", async () => {
        const { service, engine, conversations } = await build()
        conversations.isTestChat.mockResolvedValueOnce(true)

        await service.handOff(CTX, NOTE)

        expect(engine.checkGraph).not.toHaveBeenCalled()
    })
})

describe("TurnHandoffService refusals", () => {
    it("answers not found for a missing conversation or one of another workspace", async () => {
        const { service, conversations, agents } = await build()
        conversations.turnOf.mockResolvedValueOnce({ kind: "refused", code: AgentConversationsErrorCode.NotFound })
        await expect(service.handOff(CTX, NOTE)).resolves.toEqual({ status: "not_found" })
        conversations.turnOf.mockResolvedValueOnce({ kind: "ok", value: { ...CONVERSATION, workspaceId: "other" } })
        await expect(service.handOff(CTX, NOTE)).resolves.toEqual({ status: "not_found" })
        expect(agents.profileByReference).not.toHaveBeenCalled()
    })

    it("keeps a conversation a person holds, an unknown agent and the agent itself", async () => {
        const { service, conversations, agents, handover } = await build()
        conversations.turnOf.mockResolvedValueOnce({ kind: "ok", value: { ...CONVERSATION, handledBy: "Mai" } })
        await expect(service.handOff(CTX, NOTE)).resolves.toEqual({ status: "held_by_person" })
        agents.profileByReference.mockResolvedValueOnce(null)
        await expect(service.handOff(CTX, NOTE)).resolves.toEqual({ status: "no_such_agent" })
        agents.profileByReference.mockResolvedValueOnce({ ...CARE, id: "sales" })
        await expect(service.handOff(CTX, NOTE)).resolves.toEqual({ status: "already_there" })
        expect(handover.handOver).not.toHaveBeenCalled()
    })

    it("never moves an owner's test chat", async () => {
        const { service, conversations, agents, handover } = await build()
        conversations.isTestChat.mockResolvedValueOnce(true)
        await expect(service.handOff(CTX, NOTE)).resolves.toEqual({ status: "simulation" })
        expect(conversations.isTestChat).toHaveBeenCalledWith("c1")
        expect(agents.profileByReference).not.toHaveBeenCalled()
        expect(handover.handOver).not.toHaveBeenCalled()
    })

    it("notes nobody when the move did not apply", async () => {
        const { service, handover, notes } = await build()
        handover.handOver.mockResolvedValueOnce(false)
        await expect(service.handOff(CTX, NOTE)).resolves.toEqual({ status: "not_moved" })
        expect(notes.post).not.toHaveBeenCalled()
    })
})
