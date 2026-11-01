import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { EventsService } from "@modules/domain/events"
import {
    AGENT_HANDOFF,
    APPROVAL_REQUESTER,
    BOOKING_TOOLS,
    CONVERSATION_LEADS,
    GATEWAY_TOOLS,
    HANDOFF_TOOL,
    KNOWLEDGE_SEARCH,
    LEAD_WRITER,
    TOOL_TOKENS,
} from "./agent-tools.decorators"
import { AgentToolsService } from "./agent-tools.service"
import { BridgeCallsService } from "./bridge-calls.service"
import type { BridgeTurn } from "./agent-tools.contracts"
import type {
    AgentHandoff,
    ApprovalRequester,
    BookingTools,
    ConversationLeads,
    GatewayTools,
    HandoffTool,
    KnowledgeSearch,
    LeadWriter,
    ToolTokens,
} from "./agent-tools.port"
import { AgentToolsError, AgentToolsErrorCode } from "./errors/agent-tools.error"
import { TOOL_MANIFEST } from "./tool-manifest.policy"

const claims = { jobId: "job-1", workspaceId: "ws-1", conversationId: "conv-1", exp: 1_791_799_260 }
const ctx = { jobId: "job-1", workspaceId: "ws-1", conversationId: "conv-1" }

/** The service with every collaborator replaced; a null `verified` makes the token invalid. */
const customerTurn: BridgeTurn = {
    jobId: "msg-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    turnId: "turn-1",
    wakeId: "wake-1",
    source: "customer",
    conversationId: "conv-7",
    authorUserId: null,
}
const tagTurn: BridgeTurn = {
    ...customerTurn,
    jobId: "wake-2",
    wakeId: "wake-2",
    source: "tag",
    conversationId: null,
}

const build = async (verified: typeof claims | null = claims, admitted: BridgeTurn | null = customerTurn) => {
    const bridge = mock<BridgeCallsService>({
        admit: jest.fn(() =>
            admitted === null
                ? Promise.reject(new AgentToolsError({ code: AgentToolsErrorCode.TokenInvalid }))
                : Promise.resolve(admitted),
        ),
        runInternal: jest.fn(() => Promise.resolve({ tools: [] })),
    })
    const tokens = mock<ToolTokens>({
        mint: jest.fn(() => "signed-token"),
        revoke: jest.fn(),
        verify: jest.fn(() => verified),
    })
    const events = mock<EventsService>({ record: jest.fn(() => Promise.resolve()) })
    const knowledge = mock<KnowledgeSearch>({
        search: jest.fn(() =>
            Promise.resolve({ passages: "Opening hours 8-17", citations: [{ title: "Hours", topic: "faq" }] }),
        ),
    })
    const leads = mock<LeadWriter>({
        createOrUpdate: jest.fn(() => Promise.resolve({ leadId: "lead-1", status: "done" })),
    })
    const booking = mock<BookingTools>({ run: jest.fn(() => Promise.resolve({ slots: ["09:00"] })) })
    const approvals = mock<ApprovalRequester>({
        request: jest.fn(() => Promise.resolve({ workItemId: "wi-1", status: "waiting_decision" })),
    })
    const handoffs = mock<HandoffTool>({ handoff: jest.fn(() => Promise.resolve()) })
    const conversations = mock<ConversationLeads>({ leadIdOf: jest.fn(() => Promise.resolve("lead-9")) })
    const gatewayTools = mock<GatewayTools>({ run: jest.fn(() => Promise.resolve({ result: { orderId: "o1" } })) })
    const agentHandoff = mock<AgentHandoff>({
        handOff: jest.fn(() => Promise.resolve({ status: "handed_off", to: "AI Care" })),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentToolsService,
            { provide: TOOL_TOKENS, useValue: tokens },
            { provide: EventsService, useValue: events },
            { provide: KNOWLEDGE_SEARCH, useValue: knowledge },
            { provide: LEAD_WRITER, useValue: leads },
            { provide: BOOKING_TOOLS, useValue: booking },
            { provide: APPROVAL_REQUESTER, useValue: approvals },
            { provide: HANDOFF_TOOL, useValue: handoffs },
            { provide: CONVERSATION_LEADS, useValue: conversations },
            { provide: GATEWAY_TOOLS, useValue: gatewayTools },
            { provide: AGENT_HANDOFF, useValue: agentHandoff },
            { provide: BridgeCallsService, useValue: bridge },
        ],
    }).compile()
    return {
        service: moduleRef.get(AgentToolsService),
        tokens,
        events,
        knowledge,
        leads,
        booking,
        approvals,
        handoffs,
        gatewayTools,
        agentHandoff,
        bridge,
    }
}

/** The AgentToolsError a promise rejects with. */
const rejectionOf = async (run: Promise<unknown>): Promise<AgentToolsError | null> => {
    try {
        await run
        return null
    } catch (cause) {
        if (cause instanceof AgentToolsError) return cause
        throw cause
    }
}

describe("AgentToolsService > issue, revoke and manifest", () => {
    it("delegates the token to the tool token service", async () => {
        const { service, tokens } = await build()

        expect(service.issue(ctx, 60)).toBe("signed-token")
        service.revoke("job-1")

        expect(tokens.mint).toHaveBeenCalledWith(ctx, 60)
        expect(tokens.revoke).toHaveBeenCalledWith("job-1")
    })

    it("answers the manifest", async () => {
        const { service } = await build()

        expect(service.manifest()).toBe(TOOL_MANIFEST)
    })

    it("answers the manifest to a door that awaits it", async () => {
        const { service } = await build()

        await expect(service.describeTools()).resolves.toBe(TOOL_MANIFEST)
    })
})

describe("AgentToolsService > runBearerTool", () => {
    it("runs the tool for the job the bearer token names", async () => {
        const { service } = await build()

        const result = await service.runBearerTool("Bearer good", "handoff.to_person", {})

        expect(result).toEqual({ status: "handed_to_person" })
    })

    it("refuses a call with no bearer token", async () => {
        const { service } = await build(null)

        const error = await rejectionOf(service.runBearerTool(undefined, "knowledge.search", { query: "x" }))

        expect(error).toMatchObject({ code: AgentToolsErrorCode.TokenInvalid })
    })
})

describe("AgentToolsService > runTool", () => {
    it("refuses a token that does not verify, before looking at the tool", async () => {
        const { service, knowledge } = await build(null)

        const error = await rejectionOf(service.runTool("bad", "knowledge.search", { query: "x" }))

        expect(error?.code).toBe(AgentToolsErrorCode.TokenInvalid)
        expect(knowledge.search).not.toHaveBeenCalled()
    })

    it("refuses a tool that is not in the manifest", async () => {
        const { service } = await build()

        const error = await rejectionOf(service.runTool("t", "shell.exec", {}))

        expect(error?.code).toBe(AgentToolsErrorCode.UnknownTool)
        expect(error?.params).toEqual({ tool: "shell.exec" })
    })

    it("searches the knowledge for the job's own conversation and traces it", async () => {
        const { service, knowledge, events } = await build()

        const result = await service.runTool("t", "knowledge.search", {
            query: "hours",
            workspaceId: "other-ws",
            conversationId: "other-conv",
        })

        expect(result).toEqual({ passages: "Opening hours 8-17", citations: [{ title: "Hours", topic: "faq" }] })
        expect(knowledge.search).toHaveBeenCalledWith(
            { workspaceId: ctx.workspaceId, conversationId: ctx.conversationId, agentId: null },
            "hours",
        )
        expect(events.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            kind: "engine.tool.knowledge.search",
            actor: "NIVO engine",
            summary: "Knowledge search: hours",
            leadId: "lead-9",
            evidence: "job-1",
        })
    })

    it("keeps only 100 characters of the query in the evidence summary", async () => {
        const { service, events } = await build()

        await service.runTool("t", "knowledge.search", { query: "q".repeat(300) })

        expect(events.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            kind: "engine.tool.knowledge.search",
            actor: "NIVO engine",
            summary: `Knowledge search: ${"q".repeat(100)}`,
            leadId: "lead-9",
            evidence: "job-1",
        })
    })
})

describe("AgentToolsService > runTool", () => {
    it("hands the lead to the writer and traces the lead it returns", async () => {
        const { service, leads, events } = await build()

        const result = await service.runTool("t", "lead.create_or_update", {
            contact_name: "An",
            need: "a quote",
            phone: "0900",
        })

        expect(result).toEqual({ lead_id: "lead-1", status: "done" })
        expect(leads.createOrUpdate).toHaveBeenCalledWith(ctx, {
            contactName: "An",
            need: "a quote",
            company: null,
            contact: "0900",
        })
        expect(events.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            kind: "engine.tool.lead.create_or_update",
            actor: "NIVO engine",
            summary: "Lead handed to Sales through the gate (done)",
            leadId: "lead-1",
            evidence: "job-1",
        })
    })

    it("refuses a lead without a name before writing anything", async () => {
        const { service, leads, events } = await build()

        const error = await rejectionOf(service.runTool("t", "lead.create_or_update", { need: "x" }))

        expect(error?.params).toEqual({ field: "contact_name" })
        expect(leads.createOrUpdate).not.toHaveBeenCalled()
        expect(events.record).not.toHaveBeenCalled()
    })

    it("requests the owner's approval and traces the work item", async () => {
        const { service, approvals, events } = await build()

        const result = await service.runTool("t", "approval.request", {
            question: "Discount?",
            reason: "unclear_outcome",
        })

        expect(result).toEqual({ work_item_id: "wi-1", status: "waiting_decision" })
        expect(approvals.request).toHaveBeenCalledWith(ctx, {
            question: "Discount?",
            proposedAnswer: null,
            reason: "unclear_outcome",
        })
        expect(events.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            kind: "engine.tool.approval.request",
            actor: "NIVO engine",
            summary: "Approval requested from the owner (waiting_decision)",
            leadId: "lead-9",
            evidence: "wi-1",
        })
    })
})

describe("AgentToolsService > runTool", () => {
    it("hands the conversation to a person and traces the reason", async () => {
        const { service, handoffs, events } = await build()

        const result = await service.runTool("t", "handoff.to_person", { reason: "angry customer" })

        expect(result).toEqual({ status: "handed_to_person" })
        expect(handoffs.handoff).toHaveBeenCalledWith(ctx, "angry customer")
        expect(events.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            kind: "engine.tool.handoff.to_person",
            actor: "NIVO engine",
            summary: "Conversation handed to a person",
            leadId: "lead-9",
            evidence: "angry customer",
        })
    })

    it("traces the job when a handoff gives no reason", async () => {
        const { service, events } = await build()

        await service.runTool("t", "handoff.to_person", {})

        expect(events.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            kind: "engine.tool.handoff.to_person",
            actor: "NIVO engine",
            summary: "Conversation handed to a person",
            leadId: "lead-9",
            evidence: "job-1",
        })
    })

    it("leaves the booking tools to their port, which traces itself", async () => {
        const { service, booking, events } = await build()

        const result = await service.runTool("t", "booking.find_slots", { date: "2026-10-13" })

        expect(result).toEqual({ slots: ["09:00"] })
        expect(booking.run).toHaveBeenCalledWith(ctx, "booking.find_slots", { date: "2026-10-13" })
        expect(events.record).not.toHaveBeenCalled()
    })
})

describe("AgentToolsService credential admission", () => {
    it("establishes only the token's context without dispatching or consuming a call", async () => {
        const { service, tokens, knowledge, events } = await build()

        expect(service.authenticateBearer("Bearer signed-token")).toEqual(ctx)
        expect(tokens.verify).toHaveBeenCalledWith("signed-token", false)
        expect(knowledge.search).not.toHaveBeenCalled()
        expect(events.record).not.toHaveBeenCalled()
    })

    it("preserves the token-invalid refusal", async () => {
        const { service } = await build(null)

        expect(() => service.authenticateBearer(undefined)).toThrow(AgentToolsError)
    })
})

describe("AgentToolsService > connector meta-tools and agent hand-off", () => {
    it("runs a connector meta-tool through its port and traces the tool it named", async () => {
        const { service, gatewayTools, events } = await build()

        const result = await service.runTool("t", "tool.call", {
            name: "crm.order.place",
            arguments_json: '{"sku":"a"}',
        })

        expect(result).toEqual({ result: { orderId: "o1" } })
        expect(gatewayTools.run).toHaveBeenCalledWith(ctx, "tool.call", {
            name: "crm.order.place",
            arguments_json: '{"sku":"a"}',
        })
        expect(events.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            kind: "engine.tool.tool.call",
            actor: "NIVO engine",
            summary: "Connector tool.call: crm.order.place",
            leadId: "lead-9",
            evidence: "job-1",
        })
    })

    it("traces the query of a search and the name of a description", async () => {
        const { service, gatewayTools, events } = await build()

        await service.runTool("t", "tool.search", { query: "orders" })
        await service.runTool("t", "tool.describe", { name: "crm.order.place" })

        await service.runTool("t", "tool.sequence", { steps_json: "[]" })

        expect(gatewayTools.run.mock.calls.map((call) => call[1])).toEqual([
            "tool.search",
            "tool.describe",
            "tool.sequence",
        ])
        expect(events.record.mock.calls.map((call) => call[0].summary)).toEqual([
            "Connector tool.search: orders",
            "Connector tool.describe: crm.order.place",
            "Connector tool.sequence: steps",
        ])
    })

    it("hands the conversation to another agent and traces the note", async () => {
        const { service, agentHandoff, events } = await build()

        const result = await service.runTool("t", "conversation.handOff", { to: " care ", note: "booking confirmed" })

        expect(result).toEqual({ status: "handed_off", to: "AI Care" })
        expect(agentHandoff.handOff).toHaveBeenCalledWith(ctx, { to: "care", note: "booking confirmed" })
        expect(events.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            kind: "engine.tool.conversation.handOff",
            actor: "NIVO engine",
            summary: "Conversation handed to care",
            leadId: "lead-9",
            evidence: "booking confirmed",
        })
    })

    it("refuses a hand-off without a target or a note before moving anything", async () => {
        const { service, agentHandoff } = await build()

        await expect(service.runTool("t", "conversation.handOff", { to: "care" })).rejects.toMatchObject({
            code: AgentToolsErrorCode.ArgumentMissing,
        })
        expect(agentHandoff.handOff).not.toHaveBeenCalled()
    })
})

describe("AgentToolsService > the bridge credential", () => {
    it("admits a bridge credential as the workspace and job of the running turn it names, and not as a per-job token", async () => {
        const { service, bridge, tokens } = await build()

        await expect(service.authenticate("Bearer bridge.body.mac")).resolves.toEqual({
            jobId: "msg-1",
            workspaceId: "ws-1",
        })
        expect(bridge.admit).toHaveBeenCalledWith("bridge.body.mac")
        expect(tokens.verify).not.toHaveBeenCalled()
    })

    it("admits a per-job token as before, without asking the bridge", async () => {
        const { service, bridge } = await build()

        await expect(service.authenticate("Bearer signed-token")).resolves.toEqual(ctx)
        expect(bridge.admit).not.toHaveBeenCalled()
    })

    it("refuses a bridge credential that names no running turn, before any tool runs", async () => {
        const { service, knowledge } = await build(claims, null)

        const refused = await rejectionOf(service.authenticate("Bearer bridge.body.mac"))
        const call = await rejectionOf(service.runBearerTool("Bearer bridge.body.mac", "knowledge.search", {}))

        expect(refused?.code).toBe(AgentToolsErrorCode.TokenInvalid)
        expect(call?.code).toBe(AgentToolsErrorCode.TokenInvalid)
        expect(knowledge.search).not.toHaveBeenCalled()
    })

    it("runs a customer turn's tool for the conversation of the turn and not the arguments", async () => {
        const { service, knowledge } = await build()

        await service.runBearerTool("Bearer bridge.body.mac", "knowledge.search", {
            query: "hours",
            workspaceId: "ws-evil",
            conversationId: "conv-evil",
        })

        expect(knowledge.search).toHaveBeenCalledWith(
            expect.objectContaining({ workspaceId: "ws-1", conversationId: "conv-7" }),
            "hours",
        )
    })

    it("refuses an unknown tool of a bridge call", async () => {
        const { service } = await build()

        const error = await rejectionOf(service.runBearerTool("Bearer bridge.body.mac", "shell.exec", {}))

        expect(error?.code).toBe(AgentToolsErrorCode.UnknownTool)
    })

    it("lets a turn with no conversation read as its own agent, audited by the read path", async () => {
        const { service, bridge, knowledge } = await build(claims, tagTurn)

        await service.runBearerTool("Bearer bridge.body.mac", "knowledge.search", { query: "hours" })

        expect(knowledge.search).toHaveBeenCalledWith(
            { workspaceId: tagTurn.workspaceId, conversationId: null, agentId: tagTurn.agentId },
            "hours",
        )
        expect(bridge.runInternal).not.toHaveBeenCalled()
    })

    it("hands a turn with no conversation to the bridge calls, which keep it to the connector tools", async () => {
        const { service, bridge, knowledge } = await build(claims, tagTurn)

        await expect(service.runBearerTool("Bearer bridge.body.mac", "tool.search", { query: "x" })).resolves.toEqual({
            tools: [],
        })
        expect(bridge.runInternal).toHaveBeenCalledWith(tagTurn, "tool.search", { query: "x" })
        expect(knowledge.search).not.toHaveBeenCalled()
    })
})
