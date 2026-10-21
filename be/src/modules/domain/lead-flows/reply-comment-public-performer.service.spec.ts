import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { WORK_PERFORMER_REGISTRY } from "@modules/domain/decisions"
import type { PerformedBy, WorkContext, WorkItem, WorkPerformerRegistry } from "@modules/domain/decisions"
import { LeadFlowsError, LeadFlowsErrorCode } from "./errors/lead-flows.error"
import { LeadFlowConversationService } from "./lead-flow-conversation.service"
import { LeadFlowKitService } from "./lead-flow-kit.service"
import { LeadFlowMetaService } from "./lead-flow-meta.service"
import { LeadFlowStoreService } from "./lead-flow-store.service"
import { EMPTY_SIGNALS } from "./lead-flow-score.policy"
import type { LeadFlow } from "./lead-flows.contracts"
import { ReplyCommentPublicPerformerService } from "./reply-comment-public-performer.service"

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
    created_at: NOW,
    updated_at: NOW,
    completed_at: null,
    installation_id: null,
})

const build = async (flow: LeadFlow = flowOf({ last_user_text: "Too pricey" })) => {
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
    const moduleRef = await Test.createTestingModule({
        providers: [
            ReplyCommentPublicPerformerService,
            { provide: WORK_PERFORMER_REGISTRY, useValue: registry },
            { provide: LeadFlowKitService, useValue: kit },
        ],
    }).compile()
    return { performer: moduleRef.get(ReplyCommentPublicPerformerService), registry, kit, meta, transcript }
}

const by: PerformedBy = { name: "Mai", kind: "owner" }

const proposal = { summary: "", fields: { comment_id: "comment-1" }, draft: "Thanks for asking!" }

describe("ReplyCommentPublicPerformerService", () => {
    it("registers reply_comment_public at boot and drafts the public reply of the turn", async () => {
        const { performer, registry, kit } = await build()
        const item = itemOf({ proposal: { summary: "", fields: { public_reply: "We sent you a message" } } })

        performer.onModuleInit()

        expect(registry.add).toHaveBeenCalledWith("reply_comment_public", performer)
        await expect(performer.prepare(ctx, item)).resolves.toEqual({
            proposal: {
                summary: "public.summary",
                fields: { public_reply: "We sent you a message" },
                draft: "We sent you a message",
            },
        })
        expect(kit.holdForPerson).not.toHaveBeenCalled()
    })
    it("hands a negative comment to a person and leaves the reply unclear to the gate", async () => {
        const flow = flowOf({ last_user_text: "Too pricey" })
        const { performer, kit } = await build(flow)
        const item = itemOf({ proposal: { summary: "", fields: { negative: "1" } } })

        await expect(performer.prepare(ctx, item)).resolves.toEqual({
            proposal: {
                summary: "public.negative",
                fields: { negative: "1" },
                draft: "line.public-reply",
                outcome: "unclear",
            },
        })

        expect(kit.holdForPerson).toHaveBeenCalledWith(ctx, {
            flow,
            reason: "negative_comment",
            itemId: "item-1",
            question: "Too pricey",
            notify: false,
        })
    })
    it("posts the reply once and records its delivery on the stable transcript line", async () => {
        const { performer, meta, transcript } = await build()
        transcript.stableLine.mockResolvedValue({ id: "item-1", sent: false })
        meta.publicReply.mockResolvedValue({ ok: true, failure: null, recipientId: null })

        await expect(performer.perform(ctx, itemOf(), proposal, by)).resolves.toEqual({
            summary: "public.done",
            evidence: "captured",
            lead_id: "lead-1",
            detail: "Thanks for asking!",
        })

        expect(transcript.stableLine).toHaveBeenCalledWith("ws-1", "conv-1", "public.line", "Mai", "item-1")
        expect(meta.publicReply).toHaveBeenCalledWith(
            { workspaceId: "ws-1", connectionId: "connection-1", platform: "facebook", commentId: "comment-1" },
            "Thanks for asking!",
        )
        expect(transcript.markDelivery).toHaveBeenCalledWith("item-1", true, null)
    })
})

describe("ReplyCommentPublicPerformerService", () => {
    it("never posts twice when the line already went out", async () => {
        const { performer, meta, transcript } = await build()
        transcript.stableLine.mockResolvedValue({ id: "item-1", sent: true })

        await expect(performer.perform(ctx, itemOf(), proposal, by)).resolves.toMatchObject({ summary: "public.done" })

        expect(meta.publicReply).not.toHaveBeenCalled()
        expect(transcript.markDelivery).not.toHaveBeenCalled()
    })
})

describe("ReplyCommentPublicPerformerService", () => {
    it("refuses a missing comment and a reply Meta refused", async () => {
        const { performer, meta, transcript } = await build(flowOf({ conversation_id: null }))
        meta.publicReply.mockResolvedValue({ ok: false, failure: "permission", recipientId: null })

        await expect(performer.perform(ctx, itemOf(), { ...proposal, fields: {} }, by)).rejects.toEqual(
            new LeadFlowsError({ code: LeadFlowsErrorCode.NoComment }),
        )
        await expect(performer.perform(ctx, itemOf(), proposal, by)).rejects.toMatchObject({
            code: LeadFlowsErrorCode.MetaRefused,
        })

        expect(transcript.stableLine).not.toHaveBeenCalled()
    })
    it.each([
        { text: "Owner text", last: "Previous text", question: "Owner text" },
        { text: "", last: null, question: "" },
    ])("uses the negative comment text and retains an existing draft: $question", async ({ text, last, question }) => {
        const flow = flowOf({ last_user_text: last })
        const { performer, kit } = await build(flow)
        const item = itemOf({
            proposal: { summary: "Before", draft: "Owner's reply", fields: { negative: "1", text } },
        })

        await expect(performer.prepare(ctx, item)).resolves.toEqual({
            proposal: {
                summary: "public.negative",
                draft: "Owner's reply",
                fields: { negative: "1", text },
                outcome: "unclear",
            },
        })
        expect(kit.holdForPerson).toHaveBeenCalledWith(ctx, {
            flow,
            reason: "negative_comment",
            itemId: "item-1",
            question,
            notify: false,
        })
    })
    it.each([undefined, "", "   "])("refuses a missing or blank draft: %s", async (draft) => {
        const { performer, meta, transcript } = await build()

        await expect(performer.perform(ctx, itemOf(), { ...proposal, draft }, by)).rejects.toMatchObject({
            code: LeadFlowsErrorCode.NoComment,
        })
        expect(meta.publicReply).not.toHaveBeenCalled()
        expect(transcript.stableLine).not.toHaveBeenCalled()
    })
    it("requires a page before creating a transcript line", async () => {
        const { performer, meta, transcript } = await build(flowOf({ connection_id: null }))

        await expect(performer.perform(ctx, itemOf(), proposal, by)).rejects.toMatchObject({
            code: LeadFlowsErrorCode.NoPage,
        })
        expect(meta.publicReply).not.toHaveBeenCalled()
        expect(transcript.stableLine).not.toHaveBeenCalled()
    })
})

describe("ReplyCommentPublicPerformerService", () => {
    it("uses explicit channel fields and trims the reply without requiring a conversation", async () => {
        const { performer, meta, transcript, kit } = await build(flowOf({ connection_id: null, conversation_id: null }))
        meta.publicReply.mockResolvedValue({ ok: true, failure: null, recipientId: null })
        const explicit = {
            summary: "Reply",
            draft: "  Thanks!  ",
            fields: { comment_id: "comment-2", connection_id: "connection-2", platform: "instagram" },
        }

        await expect(performer.perform(ctx, itemOf(), explicit, by)).resolves.toEqual({
            summary: "public.done",
            evidence: "captured",
            lead_id: "lead-1",
            detail: "Thanks!",
        })
        expect(meta.publicReply).toHaveBeenCalledWith(
            { workspaceId: "ws-1", connectionId: "connection-2", platform: "instagram", commentId: "comment-2" },
            "Thanks!",
        )
        expect(kit.text).toHaveBeenCalledWith("en", "public.done", { name: "Lan" })
        expect(transcript.stableLine).not.toHaveBeenCalled()
        expect(transcript.markDelivery).not.toHaveBeenCalled()
    })
    it("uses the explicit conversation and rejects an unavailable Meta page", async () => {
        const { performer, meta, transcript } = await build(flowOf({ conversation_id: null }))
        transcript.stableLine.mockResolvedValue({ id: "line-2", sent: false })
        meta.publicReply.mockResolvedValue(null)

        await expect(
            performer.perform(
                ctx,
                itemOf(),
                { ...proposal, fields: { comment_id: "comment-1", conversation_id: "conv-2" } },
                by,
            ),
        ).rejects.toMatchObject({ code: LeadFlowsErrorCode.NoPage })
        expect(transcript.stableLine).toHaveBeenCalledWith("ws-1", "conv-2", "public.line", "Mai", "item-1")
        expect(transcript.markDelivery).not.toHaveBeenCalled()
    })
    it("records a failed delivery before surfacing Meta's refusal", async () => {
        const { performer, kit, meta, transcript } = await build()
        transcript.stableLine.mockResolvedValue({ id: "line-1", sent: false })
        meta.publicReply.mockResolvedValue({ ok: false, failure: null, recipientId: null })

        await expect(performer.perform(ctx, itemOf(), proposal, by)).rejects.toMatchObject({
            code: LeadFlowsErrorCode.MetaRefused,
            params: { failure: "error" },
        })
        expect(transcript.markDelivery).toHaveBeenCalledWith("line-1", false, null)
        expect(kit.metaRefused).toHaveBeenCalledWith(null)
        expect(kit.done).not.toHaveBeenCalled()
    })
})
