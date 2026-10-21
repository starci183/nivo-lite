import { Test } from "@nestjs/testing"
import { FakeClock, builder, mock } from "@starci/jest-preset"
import { CommandBusService, EvidenceService, WorkEngineService } from "@modules/domain/decisions"
import type { WorkContext } from "@modules/domain/decisions"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { LeadFlowsErrorCode } from "./errors/lead-flows.error"
import { LEAD_GEN_ACTOR, LeadFlowConversationService } from "./lead-flow-conversation.service"
import { LeadFlowKitService } from "./lead-flow-kit.service"
import { LeadFlowMetaService } from "./lead-flow-meta.service"
import { LeadFlowStoreService } from "./lead-flow-store.service"
import { EMPTY_SIGNALS } from "./lead-flow-score.policy"
import type { LeadFlow } from "./lead-flows.contracts"

import { NOW, itemOf } from "@tests/fixtures/builders/lead-flow-kit.builder"

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

const build = async () => {
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key) => key)
    const store = mock<LeadFlowStoreService>()
    const meta = mock<LeadFlowMetaService>()
    const transcript = mock<LeadFlowConversationService>()
    const engine = mock<WorkEngineService>()
    const commands = mock<CommandBusService>()
    const evidence = mock<EvidenceService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadFlowKitService,
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LeadFlowStoreService, useValue: store },
            { provide: LeadFlowMetaService, useValue: meta },
            { provide: LeadFlowConversationService, useValue: transcript },
            { provide: WorkEngineService, useValue: engine },
            { provide: CommandBusService, useValue: commands },
            { provide: EvidenceService, useValue: evidence },
        ],
    }).compile()
    return { kit: moduleRef.get(LeadFlowKitService), catalog, store, meta, transcript, engine, commands, evidence }
}

describe("LeadFlowKitService", () => {
    it("reads lead-flow texts, the time and what a step did", async () => {
        const { kit, catalog } = await build()

        expect(kit.text("en", "greet.done", { name: "Lan" })).toBe("lead-flows.greet.done")
        expect(catalog.get).toHaveBeenCalledWith("lead-flows.greet.done", { name: "Lan" }, "en")
        expect(kit.now()).toBe(NOW)
        expect(kit.nameOf(ctx, flowOf({ name: null }))).toBe("lead-flows.customer")
        expect(kit.done("Greeted", flowOf(), "Hello")).toEqual({
            summary: "Greeted",
            evidence: "captured",
            href: "/leads/lead-1",
            lead_id: "lead-1",
            detail: "Hello",
        })
        expect(kit.done("Nothing", null)).toEqual({
            summary: "Nothing",
            evidence: "captured",
            href: "/chat",
            lead_id: null,
            detail: null,
        })
    })
    it("stores a direct message in the transcript with its delivery", async () => {
        const { kit, meta, transcript } = await build()
        meta.sendToFlow.mockResolvedValue({ ok: false, reason: "failed", detail: "token" })

        await expect(kit.dm(ctx, flowOf(), "Hello")).resolves.toEqual({ ok: false, reason: "failed", detail: "token" })

        expect(meta.sendToFlow).toHaveBeenCalledWith("ws-1", flowOf(), "Hello", false)
        expect(transcript.say).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            conversationId: "conv-1",
            role: "agent",
            body: "Hello",
            delivery: { sent: false, error: "meta_token" },
        })
    })
})

describe("LeadFlowKitService", () => {
    it("proposes a tagged reply for a person once the 24 hour window has passed", async () => {
        const { kit, meta, transcript, commands } = await build()
        meta.sendToFlow.mockResolvedValue({ ok: false, reason: "tag_only", detail: null })

        await expect(kit.dmOrExplain(ctx, itemOf(), flowOf(), "Hello", true)).resolves.toEqual({
            sent: false,
            line: "lead-flows.tag.proposed",
        })

        expect(transcript.say).not.toHaveBeenCalled()
        expect(commands.sendCommand).toHaveBeenCalledWith(ctx, {
            from: "lead_gen",
            to: "lead_gen",
            command: "message_with_human_agent_tag",
            reason: "outside_24h",
            parentId: "item-1",
            chainId: "chain-1",
            inboundEventId: null,
            queue: true,
            dedupeKey: "message_with_human_agent_tag:item-1",
            payload: {
                subject_type: "lead",
                subject_id: "lead-1",
                lead_id: "lead-1",
                contact: "person-1",
                conversation_id: "conv-1",
            },
            seed: { summary: "lead-flows.tag.summary", draft: "Hello" },
        })
    })
})

describe("LeadFlowKitService", () => {
    it("explains a message that could not go and refuses a Meta failure", async () => {
        const { kit, meta, commands } = await build()
        meta.sendToFlow.mockResolvedValueOnce({ ok: false, reason: "no_recipient", detail: null })
        meta.sendToFlow.mockResolvedValueOnce({ ok: false, reason: "failed", detail: "token" })

        await expect(kit.dmOrExplain(ctx, itemOf(), flowOf(), "Hello", true)).resolves.toEqual({
            sent: false,
            line: "lead-flows.not-sent.no-recipient",
        })
        await expect(kit.dmOrExplain(ctx, itemOf(), flowOf(), "Hello", true)).rejects.toMatchObject({
            code: LeadFlowsErrorCode.MetaRefused,
        })

        expect(commands.sendCommand).not.toHaveBeenCalled()
    })
    it("holds the prospect for a person, silences the bot and tells the person once", async () => {
        const { kit, store, meta, transcript, evidence } = await build()
        const flow = flowOf({ state: "qualifying" })
        const held = flowOf({ state: "escalated" })
        store.patch.mockResolvedValue(held)
        meta.sendToFlow.mockResolvedValue({ ok: true, reason: null, detail: null })

        await expect(
            kit.holdForPerson(ctx, { flow, reason: "refund", itemId: "item-9", question: "Money back", notify: true }),
        ).resolves.toBe(held)

        expect(store.patch).toHaveBeenCalledWith(flow, {
            state: "escalated",
            resume_state: "qualifying",
            escalated_at: NOW,
            escalation_reason: "refund",
        })
        expect(transcript.handToPerson).toHaveBeenCalledWith("ws-1", "conv-1")
        expect(evidence.log).toHaveBeenCalledWith(ctx, {
            lead_id: "lead-1",
            work_item_id: "item-9",
            kind: "lead_gen.escalated",
            actor: LEAD_GEN_ACTOR,
            summary: "lead-flows.escalate.evidence",
            evidence: "Money back",
        })
        expect(meta.sendToFlow).toHaveBeenCalledWith("ws-1", held, "lead-flows.line.handover", false)
    })
})

describe("LeadFlowKitService", () => {
    it("uses names and localized source labels, including the default message source", async () => {
        const { kit, catalog } = await build()

        expect(kit.nameOf(ctx, flowOf())).toBe("Lan")
        expect(kit.nameOf(ctx, null, "prospect")).toBe("lead-flows.prospect")
        expect(kit.sourceLine("en", null)).toBe("Facebook · lead-flows.kind.dm")
        expect(
            kit.sourceLine("en", {
                platform: "instagram",
                kind: "leadgen",
                form_id: "form-1",
                ad_id: "ad-1",
                post_id: "post-1",
                comment_id: null,
                leadgen_id: "submission-1",
                referral: null,
                at: NOW,
            }),
        ).toBe(
            "Instagram · lead-flows.kind.leadgen · lead-flows.word.form form-1 · lead-flows.word.ad ad-1 · " +
                "lead-flows.word.post post-1",
        )
        expect(catalog.get).toHaveBeenCalledWith("lead-flows.kind.leadgen", {}, "en")
    })
})

describe("LeadFlowKitService", () => {
    it.each([null, "", "x".repeat(401)])("stores bounded evidence for %s", async (value) => {
        const { kit, evidence } = await build()

        await kit.log(ctx, flowOf(), "item-2", "lead_gen.test", "Recorded", value)

        expect(evidence.log).toHaveBeenCalledWith(ctx, {
            lead_id: "lead-1",
            work_item_id: "item-2",
            kind: "lead_gen.test",
            actor: LEAD_GEN_ACTOR,
            summary: "Recorded",
            evidence: value ? "x".repeat(400) : null,
        })
    })
    it("records successful tagged delivery and a failure without a detail", async () => {
        const { kit, meta, transcript } = await build()
        meta.sendToFlow.mockResolvedValueOnce({ ok: true, reason: null, detail: null })
        meta.sendToFlow.mockResolvedValueOnce({ ok: false, reason: "failed", detail: null })

        await expect(kit.dm(ctx, flowOf(), "A person replied", true)).resolves.toEqual({
            ok: true,
            reason: null,
            detail: null,
        })
        await expect(kit.dm(ctx, flowOf(), "Retry")).resolves.toEqual({ ok: false, reason: "failed", detail: null })

        expect(meta.sendToFlow).toHaveBeenNthCalledWith(1, "ws-1", flowOf(), "A person replied", true)
        expect(transcript.say.mock.calls).toEqual([
            [
                {
                    workspaceId: "ws-1",
                    conversationId: "conv-1",
                    role: "agent",
                    body: "A person replied",
                    delivery: { sent: true, error: null },
                },
            ],
            [
                {
                    workspaceId: "ws-1",
                    conversationId: "conv-1",
                    role: "agent",
                    body: "Retry",
                    delivery: { sent: false, error: "meta_error" },
                },
            ],
        ])
    })
})

describe("LeadFlowKitService", () => {
    it("prepares closing lines from a trimmed reply and omits empty proposal text", async () => {
        const { kit, store, catalog } = await build()
        store.requireByLead.mockResolvedValue(flowOf())
        const item = itemOf({ proposal: { summary: "Before", fields: { reply: "  Thank you  ", keep: 1 } } })

        await expect(kit.lineProposal(ctx, item, "line.close", "close.summary")).resolves.toEqual({
            proposal: {
                summary: "lead-flows.close.summary",
                fields: item.proposal.fields,
                draft: "Thank you\n\nlead-flows.line.close",
            },
        })
        catalog.get.mockImplementation((key) => (key === "lead-flows.line.close" ? "" : key))
        await expect(kit.lineProposal(ctx, itemOf(), "line.close", "close.summary")).resolves.toEqual({
            proposal: { summary: "lead-flows.close.summary", fields: {}, draft: "" },
        })

        expect(store.requireByLead).toHaveBeenCalledWith("ws-1", "lead-1")
        expect(catalog.get).toHaveBeenCalledWith("lead-flows.close.summary", { name: "Lan" }, "en")
    })
})

describe("LeadFlowKitService", () => {
    it("returns successful delivery and explains a disconnected or unoffered tagged reply", async () => {
        const { kit, meta, commands } = await build()
        meta.sendToFlow.mockResolvedValueOnce({ ok: true, reason: null, detail: null })
        meta.sendToFlow.mockResolvedValueOnce({ ok: false, reason: "not_connected", detail: null })
        meta.sendToFlow.mockResolvedValueOnce({ ok: false, reason: "tag_only", detail: null })

        await expect(kit.dmOrExplain(ctx, itemOf(), flowOf(), "Hello", true)).resolves.toEqual({ sent: true, line: "" })
        await expect(kit.dmOrExplain(ctx, itemOf(), flowOf(), "Hello", true)).resolves.toEqual({
            sent: false,
            line: "lead-flows.not-sent.no-page",
        })
        await expect(kit.dmOrExplain(ctx, itemOf(), flowOf(), "Hello", false)).resolves.toEqual({
            sent: false,
            line: "lead-flows.not-sent.window",
        })
        expect(kit.metaRefused(null)).toMatchObject({
            code: LeadFlowsErrorCode.MetaRefused,
            params: { failure: "error" },
        })
        expect(kit.metaRefused("token").params).toEqual({ failure: "token" })
        expect(commands.sendCommand).not.toHaveBeenCalled()
    })
    it.each([
        {
            phone: "84123456789",
            email: "person@example.com",
            psid: "person-1",
            igsid: "ig-person",
            contact: "84123456789",
        },
        {
            phone: null,
            email: "person@example.com",
            psid: "person-1",
            igsid: "ig-person",
            contact: "person@example.com",
        },
        { phone: null, email: null, psid: null, igsid: "ig-person", contact: "ig-person" },
        { phone: null, email: null, psid: null, igsid: null, contact: "" },
    ])("proposes tagged replies with contact $contact and an item chain fallback", async ({ contact, ...identity }) => {
        const { kit, meta, commands } = await build()
        const flow = flowOf({ ...identity, conversation_id: null })
        meta.sendToFlow.mockResolvedValue({ ok: false, reason: "tag_only", detail: null })

        await expect(kit.dmOrExplain(ctx, itemOf({ chain_id: null }), flow, "Hello", true)).resolves.toEqual({
            sent: false,
            line: "lead-flows.tag.proposed",
        })

        expect(commands.sendCommand).toHaveBeenCalledWith(ctx, {
            from: "lead_gen",
            to: "lead_gen",
            command: "message_with_human_agent_tag",
            reason: "outside_24h",
            parentId: "item-1",
            chainId: "item-1",
            inboundEventId: null,
            queue: true,
            dedupeKey: "message_with_human_agent_tag:item-1",
            payload: { subject_type: "lead", subject_id: "lead-1", lead_id: "lead-1", contact, conversation_id: "" },
            seed: { summary: "lead-flows.tag.summary", draft: "Hello" },
        })
    })
})

describe("LeadFlowKitService", () => {
    it.each([
        {
            state: "escalated" as const,
            resume_state: "greeted" as const,
            escalated_at: "2026-10-11T00:00:00.000Z",
            notify: true,
        },
        { state: "qualifying" as const, resume_state: null, escalated_at: null, notify: false },
    ])("holds a $state flow without a conversation or another notification", async ({ notify, ...state }) => {
        const { kit, store, meta, transcript, evidence } = await build()
        const flow = flowOf({ ...state, conversation_id: null })
        const held = flowOf({ state: "escalated" })
        store.patch.mockResolvedValue(held)

        await expect(
            kit.holdForPerson(ctx, { flow, reason: "angry", itemId: "item-2", question: "", notify }),
        ).resolves.toBe(held)

        expect(store.patch).toHaveBeenCalledWith(flow, {
            state: "escalated",
            resume_state: state.state === "escalated" ? "greeted" : "qualifying",
            escalated_at: state.state === "escalated" ? state.escalated_at : NOW,
            escalation_reason: "angry",
        })
        expect(evidence.log).toHaveBeenCalledWith(ctx, {
            lead_id: "lead-1",
            work_item_id: "item-2",
            kind: "lead_gen.escalated",
            actor: LEAD_GEN_ACTOR,
            summary: "lead-flows.escalate.evidence",
            evidence: null,
        })
        expect(transcript.handToPerson).not.toHaveBeenCalled()
        expect(transcript.say).not.toHaveBeenCalled()
        expect(meta.sendToFlow).not.toHaveBeenCalled()
    })
})

describe("LeadFlowKitService", () => {
    it.each([
        { conversationId: "conv-1", chainId: "chain-1", text: `  ${"x".repeat(130)}  `, question: "x".repeat(130) },
        { conversationId: null, chainId: null, text: "   ", question: "lead-flows.no-text" },
    ])(
        "escalates a turn for conversation $conversationId with a bounded question summary",
        async ({ conversationId, chainId, text, question }) => {
            const { kit, store, engine, catalog } = await build()
            const flow = flowOf({ conversation_id: conversationId })
            const held = flowOf({ state: "escalated" })
            engine.runWork.mockResolvedValue(itemOf({ id: "ask-1" }))
            store.patch.mockResolvedValue(held)

            await expect(
                kit.escalate(ctx, {
                    flow,
                    reason: "real_person",
                    item: itemOf({ chain_id: chainId }),
                    text,
                    turn: "turn-1",
                    notify: false,
                }),
            ).resolves.toBe(held)

            expect(engine.runWork).toHaveBeenCalledWith(ctx, {
                action: "reply_customer",
                subject_type: conversationId === null ? "lead" : "conversation",
                subject_id: conversationId ?? "lead-1",
                lead_id: "lead-1",
                parent_id: "item-1",
                chainId: chainId ?? "item-1",
                dedupeKey: "reply_customer:lead_gen:flow-1:turn-1",
                preset: true,
                noChain: true,
                forceAsk: "unclear_outcome",
                seed: {
                    summary: "lead-flows.escalate.item",
                    draft: "",
                    fields: {
                        question,
                        escalation: "real_person",
                        ...(conversationId === null ? {} : { conversation_id: conversationId }),
                    },
                },
            })
            expect(catalog.get).toHaveBeenCalledWith(
                "lead-flows.escalate.item",
                {
                    name: "Lan",
                    reason: "lead-flows.reason.real_person",
                    question: question.slice(0, 120),
                },
                "en",
            )
        },
    )
})

describe("LeadFlowKitService", () => {
    it.each(["greeted" as const, null])("resumes an escalated flow from %s", async (resumeState) => {
        const { kit, store } = await build()
        const flow = flowOf({ state: "escalated", resume_state: resumeState })
        const resumed = flowOf({ state: resumeState ?? "qualifying" })
        store.patch.mockResolvedValue(resumed)

        await expect(kit.resume(flow)).resolves.toBe(resumed)

        expect(store.patch).toHaveBeenCalledWith(flow, {
            state: resumeState ?? "qualifying",
            resume_state: null,
            escalated_at: null,
            escalation_reason: null,
        })
    })
})
