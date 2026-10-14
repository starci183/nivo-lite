import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { WORK_PERFORMER_REGISTRY } from "@modules/domain/decisions"
import type { WorkContext, WorkItem, WorkPerformerRegistry } from "@modules/domain/decisions"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { LeadFlowsError, LeadFlowsErrorCode } from "./errors/lead-flows.error"
import { LeadFlowConversationService } from "./lead-flow-conversation.service"
import { LeadFlowKitService } from "./lead-flow-kit.service"
import { LeadFlowMetaService } from "./lead-flow-meta.service"
import { LeadFlowStoreService } from "./lead-flow-store.service"
import { EMPTY_SIGNALS } from "./lead-flow-score.policy"
import { LeadFlowsLogEvent } from "./lead-flows.log-events"
import type { LeadFlow } from "./lead-flows.contracts"
import { PrivateReplyCommentPerformerService } from "./private-reply-comment-performer.service"

const NOW = "2026-10-12T10:00:00.000Z"
const ctx: WorkContext = { workspaceId: "ws-1", actor: "Lan", locale: "en" }

const flowOf = builder<LeadFlow>({
    id: "flow-1",
    workspace_id: "ws-1",
    lead_id: "lead-1",
    connection_id: "connection-1",
    conversation_id: "conv-1",
    platform: "facebook",
    psid: "person-1",
    igsid: null,
    phone: null,
    email: null,
    name: "Lan",
    state: "new",
    resume_state: null,
    source: null,
    touches: [],
    answers: [],
    asked: 0,
    pending_question: null,
    contact_asked_at: null,
    signals: EMPTY_SIGNALS,
    score: null,
    score_reasons: [],
    scored_at: null,
    analysis: null,
    last_user_at: null,
    last_user_text: null,
    greeted_at: null,
    handed_off_at: null,
    followed_up_at: null,
    closed_at: null,
    escalated_at: null,
    escalation_reason: null,
})

const itemOf = builder<WorkItem>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "lead_gen",
    action: "greet_prospect",
    subject_type: "lead",
    subject_id: "lead-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    parent_id: null,
    chain_id: "chain-1",
    depth: 1,
    status: "queued",
    decided_path: "auto",
    reason: null,
    reasons: [],
    missing_fields: [],
    proposal: { summary: "", fields: {} },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    origin: "live",
    created_at: NOW,
    updated_at: NOW,
    completed_at: null,
    installation_id: null,
})

const build = async (flow: LeadFlow = flowOf({ psid: null })) => {
    const registry = mock<WorkPerformerRegistry>()
    const store = mock<LeadFlowStoreService>()
    const meta = mock<LeadFlowMetaService>()
    const transcript = mock<LeadFlowConversationService>()
    const kit = mock<LeadFlowKitService>({
        store,
        meta,
        transcript,
    })
    kit.text.mockImplementation((_locale, key) => key)
    kit.nameOf.mockReturnValue("Lan")
    kit.now.mockReturnValue(NOW)
    kit.done.mockImplementation((summary, done, detail = null) => ({
        summary,
        evidence: "captured",
        lead_id: done?.lead_id ?? null,
        detail,
    }))
    kit.metaRefused.mockImplementation(
        (failure) =>
            new LeadFlowsError({ code: LeadFlowsErrorCode.MetaRefused, params: { failure: failure ?? "error" } }),
    )
    store.requireByLead.mockResolvedValue(flow)
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            PrivateReplyCommentPerformerService,
            { provide: WORK_PERFORMER_REGISTRY, useValue: registry },
            { provide: LeadFlowKitService, useValue: kit },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return {
        performer: moduleRef.get(PrivateReplyCommentPerformerService),
        registry,
        kit,
        store,
        meta,
        transcript,
        logger,
    }
}

const proposal = { summary: "", fields: { comment_id: "comment-1" }, draft: "Hi, here are the details" }
const sentTo = (recipientId: string | null) => ({ ok: true, failure: null, recipientId })

describe("PrivateReplyCommentPerformerService", () => {
    it("registers private_reply_comment at boot and drafts the private reply of the turn", async () => {
        const { performer, registry } = await build()
        const item = itemOf({ proposal: { summary: "", fields: { private_reply: "Check your inbox" } } })

        performer.onModuleInit()

        expect(registry.add).toHaveBeenCalledWith("private_reply_comment", performer)
        await expect(performer.prepare(ctx, item)).resolves.toEqual({
            proposal: {
                summary: "private.summary",
                fields: { private_reply: "Check your inbox" },
                draft: "Check your inbox",
            },
        })
    })

    it("sends the one private reply, links the person it reached and stores the line", async () => {
        const flow = flowOf({ psid: null })
        const { performer, meta, store, transcript } = await build(flow)
        meta.privateReply.mockResolvedValue(sentTo("person-9"))

        await expect(performer.perform(ctx, itemOf(), proposal)).resolves.toEqual({
            summary: "private.done",
            evidence: "captured",
            lead_id: "lead-1",
            detail: "Hi, here are the details",
        })

        expect(meta.privateReply).toHaveBeenCalledWith(
            { workspaceId: "ws-1", connectionId: "connection-1", platform: "facebook", commentId: "comment-1" },
            "Hi, here are the details",
        )
        expect(store.patch).toHaveBeenCalledWith(flow, { greeted_at: NOW, state: "greeted", psid: "person-9" })
        expect(transcript.say).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            conversationId: "conv-1",
            role: "agent",
            body: "Hi, here are the details",
            delivery: { sent: true, error: null },
        })
    })

    it("still greets the flow when the person is already linked elsewhere", async () => {
        const flow = flowOf({ psid: null })
        const { performer, meta, store, logger } = await build(flow)
        const failure = new Error("unique psid")
        meta.privateReply.mockResolvedValue(sentTo("person-9"))
        store.patch.mockRejectedValueOnce(failure)

        await performer.perform(ctx, itemOf(), proposal)

        expect(logger.error).toHaveBeenCalledWith(LeadFlowsLogEvent.PersonNotLinked, failure, { flowId: "flow-1" })
        expect(store.patch).toHaveBeenLastCalledWith(flow, { greeted_at: NOW, state: "greeted" })
    })

    it("answers a repeat or an expired comment without an error", async () => {
        const { performer, meta, transcript } = await build()
        meta.privateReply.mockResolvedValueOnce({ ok: false, failure: "already_replied", recipientId: null })
        meta.privateReply.mockResolvedValueOnce({ ok: false, failure: "private_reply_expired", recipientId: null })

        await expect(performer.perform(ctx, itemOf(), proposal)).resolves.toMatchObject({ summary: "private.already" })
        await expect(performer.perform(ctx, itemOf(), proposal)).resolves.toMatchObject({ summary: "private.expired" })

        expect(transcript.say).not.toHaveBeenCalled()
    })

    it("refuses a step without a comment, without a Page, or that Meta refused", async () => {
        const { performer, meta } = await build(flowOf({ connection_id: null }))

        await expect(performer.perform(ctx, itemOf(), { summary: "", fields: {} })).rejects.toEqual(
            new LeadFlowsError({ code: LeadFlowsErrorCode.NoComment }),
        )
        await expect(performer.perform(ctx, itemOf(), proposal)).rejects.toEqual(
            new LeadFlowsError({ code: LeadFlowsErrorCode.NoPage }),
        )
        meta.privateReply.mockResolvedValue({ ok: false, failure: "token", recipientId: null })
        const withPage = { ...proposal, fields: { ...proposal.fields, connection_id: "connection-1" } }
        await expect(performer.perform(ctx, itemOf(), withPage)).rejects.toMatchObject({
            code: LeadFlowsErrorCode.MetaRefused,
        })
    })

    it.each([
        { name: null, draft: undefined, expected: "line.private-greet" },
        { name: "Lan", draft: undefined, expected: "line.private-greet-named" },
        { name: "Lan", draft: "An existing draft", expected: "An existing draft" },
    ])("prepares the greeting or draft for $expected", async ({ name, draft, expected }) => {
        const { performer, kit, store } = await build(flowOf({ name }))
        const item = itemOf({ proposal: { summary: "Original", fields: {}, draft } })

        await expect(performer.prepare(ctx, item)).resolves.toEqual({
            proposal: { summary: "private.summary", fields: {}, draft: expected },
        })

        expect(store.requireByLead).toHaveBeenCalledWith("ws-1", "lead-1")
        expect(kit.nameOf).toHaveBeenCalledWith(ctx, flowOf({ name }), "commenter")
        if (name === null) expect(kit.text).toHaveBeenCalledWith("en", "line.private-greet")
        else expect(kit.text).toHaveBeenCalledWith("en", "line.private-greet-named", { name: "Lan" })
    })

    it("uses the proposal connection and conversation and an empty absent draft", async () => {
        const flow = flowOf({ platform: "instagram", igsid: null, state: "qualifying" })
        const { performer, meta, store, transcript } = await build(flow)
        meta.privateReply.mockResolvedValue(sentTo("instagram-person"))
        const custom = {
            summary: "",
            fields: { comment_id: "comment-2", connection_id: "other-page", conversation_id: "other-chat" },
        }

        await expect(performer.perform(ctx, itemOf(), custom)).resolves.toEqual({
            summary: "private.done",
            evidence: "captured",
            lead_id: "lead-1",
            detail: "",
        })

        expect(meta.privateReply).toHaveBeenCalledWith(
            { workspaceId: "ws-1", connectionId: "other-page", platform: "instagram", commentId: "comment-2" },
            "",
        )
        expect(store.patch).toHaveBeenCalledWith(flow, { greeted_at: NOW, igsid: "instagram-person" })
        expect(transcript.say).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            conversationId: "other-chat",
            role: "agent",
            body: "",
            delivery: { sent: true, error: null },
        })
    })

    it.each([
        { platform: "facebook" as const, psid: "known-person", igsid: null, recipientId: "replacement" },
        { platform: "instagram" as const, psid: null, igsid: "known-person", recipientId: "replacement" },
        { platform: "facebook" as const, psid: null, igsid: null, recipientId: null },
    ])(
        "retains an existing $platform identity or an absent recipient",
        async ({ platform, psid, igsid, recipientId }) => {
            const flow = flowOf({ platform, psid, igsid, state: "greeted" })
            const { performer, meta, store } = await build(flow)
            meta.privateReply.mockResolvedValue(sentTo(recipientId))

            await expect(performer.perform(ctx, itemOf(), proposal)).resolves.toEqual({
                summary: "private.done",
                evidence: "captured",
                lead_id: "lead-1",
                detail: "Hi, here are the details",
            })

            expect(store.patch).toHaveBeenCalledTimes(1)
            expect(store.patch).toHaveBeenCalledWith(flow, { greeted_at: NOW })
        },
    )

    it("treats an unknown comment age as expired without greeting or storing a line", async () => {
        const { performer, meta, store, transcript } = await build()
        meta.privateReply.mockResolvedValue({ ok: false, failure: "comment_age_unknown", recipientId: null })

        await expect(performer.perform(ctx, itemOf(), proposal)).resolves.toEqual({
            summary: "private.expired",
            evidence: "captured",
            lead_id: "lead-1",
            detail: null,
        })

        expect(store.patch).not.toHaveBeenCalled()
        expect(transcript.say).not.toHaveBeenCalled()
    })

    it("refuses a missing Page result or an unspecified Meta failure", async () => {
        const { performer, meta, kit, transcript } = await build()
        meta.privateReply.mockResolvedValueOnce(null)
        meta.privateReply.mockResolvedValueOnce({ ok: false, failure: null, recipientId: null })

        await expect(performer.perform(ctx, itemOf(), proposal)).rejects.toEqual(
            new LeadFlowsError({ code: LeadFlowsErrorCode.NoPage }),
        )
        await expect(performer.perform(ctx, itemOf(), proposal)).rejects.toEqual(
            new LeadFlowsError({ code: LeadFlowsErrorCode.MetaRefused, params: { failure: "error" } }),
        )

        expect(kit.metaRefused).toHaveBeenCalledWith(null)
        expect(transcript.say).not.toHaveBeenCalled()
    })
})
