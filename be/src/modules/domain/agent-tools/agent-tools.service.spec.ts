import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { EventsService } from "@modules/domain/events"
import { ToolTokenService } from "@modules/integrations/openclaw"
import {
    APPROVAL_REQUESTER,
    BOOKING_TOOLS,
    CONVERSATION_LEADS,
    HANDOFF_TOOL,
    KNOWLEDGE_SEARCH,
    LEAD_WRITER,
} from "./agent-tools.decorators"
import { AgentToolsService } from "./agent-tools.service"
import type {
    ApprovalRequester,
    BookingTools,
    ConversationLeads,
    HandoffTool,
    KnowledgeSearch,
    LeadWriter,
} from "./agent-tools.port"
import { AgentToolsError, AgentToolsErrorCode } from "./errors/agent-tools.error"
import { TOOL_MANIFEST } from "./tool-manifest.policy"

const claims = { jobId: "job-1", workspaceId: "ws-1", conversationId: "conv-1", exp: 1_791_799_260 }
const ctx = { jobId: "job-1", workspaceId: "ws-1", conversationId: "conv-1" }

/** The service with every collaborator replaced; a null `verified` makes the token invalid. */
const build = async (verified: typeof claims | null = claims) => {
    const tokens = mock<ToolTokenService>({
        mint: jest.fn(() => "signed-token"),
        revoke: jest.fn(),
        verify: jest.fn(() => verified),
    })
    const events = mock<EventsService>({ record: jest.fn(async () => undefined) })
    const knowledge = mock<KnowledgeSearch>({
        search: jest.fn(async () => ({
            passages: "Opening hours 8-17",
            citations: [{ title: "Hours", topic: "faq" }],
        })),
    })
    const leads = mock<LeadWriter>({ createOrUpdate: jest.fn(async () => ({ leadId: "lead-1", status: "done" })) })
    const booking = mock<BookingTools>({ run: jest.fn(async () => ({ slots: ["09:00"] })) })
    const approvals = mock<ApprovalRequester>({
        request: jest.fn(async () => ({ workItemId: "wi-1", status: "waiting_decision" })),
    })
    const handoffs = mock<HandoffTool>({ handoff: jest.fn(async () => undefined) })
    const conversations = mock<ConversationLeads>({ leadIdOf: jest.fn(async () => "lead-9") })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentToolsService,
            { provide: ToolTokenService, useValue: tokens },
            { provide: EventsService, useValue: events },
            { provide: KNOWLEDGE_SEARCH, useValue: knowledge },
            { provide: LEAD_WRITER, useValue: leads },
            { provide: BOOKING_TOOLS, useValue: booking },
            { provide: APPROVAL_REQUESTER, useValue: approvals },
            { provide: HANDOFF_TOOL, useValue: handoffs },
            { provide: CONVERSATION_LEADS, useValue: conversations },
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

describe("AgentToolsService", () => {
    describe("issue, revoke and manifest", () => {
        it("delegates the token to the tool token service", async () => {
            const { service, tokens } = await build()
            const subject = { jobId: "job-1", workspaceId: "ws-1", conversationId: "conv-1" }

            expect(service.issue(subject, 60)).toBe("signed-token")
            service.revoke("job-1")

            expect(tokens.mint).toHaveBeenCalledWith(subject, 60)
            expect(tokens.revoke).toHaveBeenCalledWith("job-1")
        })

        it("answers the manifest", async () => {
            const { service } = await build()

            expect(service.manifest()).toBe(TOOL_MANIFEST)
        })
    })

    describe("runTool", () => {
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
            expect(knowledge.search).toHaveBeenCalledWith(ctx, "hours")
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

            expect(events.record).toHaveBeenCalledWith(
                expect.objectContaining({ summary: `Knowledge search: ${"q".repeat(100)}` }),
            )
        })

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

            expect(events.record).toHaveBeenCalledWith(expect.objectContaining({ evidence: "job-1" }))
        })

        it("leaves the booking tools to their port, which traces itself", async () => {
            const { service, booking, events } = await build()

            const result = await service.runTool("t", "booking.find_slots", { date: "2026-10-13" })

            expect(result).toEqual({ slots: ["09:00"] })
            expect(booking.run).toHaveBeenCalledWith(ctx, "booking.find_slots", { date: "2026-10-13" })
            expect(events.record).not.toHaveBeenCalled()
        })
    })
})
