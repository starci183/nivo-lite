import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { CommandBusService, WorkEngineService } from "@modules/domain/decisions"
import type { LeadGenContinuePayload, LeadGenFinishedStep } from "@modules/queues/lead-gen"
import { LEAD_GEN_ACTOR } from "./lead-flow-conversation.service"
import { LeadFlowContinuationService } from "./lead-flow-continuation.service"

const ctx = { workspaceId: "ws-1", actor: LEAD_GEN_ACTOR, locale: "vi" }

const stepOf = builder<LeadGenFinishedStep>({
    id: "item-1",
    action: "capture_lead",
    leadId: "lead-1",
    chainId: "chain-1",
    fields: {},
    draft: "",
})

const payloadOf = (step: LeadGenFinishedStep, inboundEventId: string | null = null): LeadGenContinuePayload => ({
    workspaceId: "ws-1",
    locale: "vi",
    inboundEventId,
    step,
})

const build = async () => {
    const commands = mock<CommandBusService>()
    const engine = mock<WorkEngineService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            LeadFlowContinuationService,
            { provide: CommandBusService, useValue: commands },
            { provide: WorkEngineService, useValue: engine },
        ],
    }).compile()
    return { continuation: moduleRef.get(LeadFlowContinuationService), commands, engine }
}

const continuationCases = [
    {
        plan: "handoff",
        command: "handoff_to_sales",
        reason: "hot_lead",
        dedupeKey: "handoff_to_sales:lead-1",
        extra: { contact: "0912", need: "tea", score: "hot" },
    },
    {
        plan: "greet",
        command: "greet_prospect",
        reason: "first_reply",
        dedupeKey: "greet_prospect:lead-1",
        extra: {},
    },
    {
        plan: "ask_contact",
        command: "ask_qualifying",
        reason: "ask_contact",
        dedupeKey: "ask_qualifying:lead-1:contact",
        extra: { index: 0, question_kind: "contact" },
    },
    {
        plan: "follow_up",
        command: "follow_up_lead",
        reason: "warm_lead",
        dedupeKey: "follow_up_lead:lead-1:t:2",
        extra: {},
    },
    { plan: "close", command: "close_lead", reason: "cold_lead", dedupeKey: "close_lead:lead-1:t:2", extra: {} },
    {
        plan: "comment",
        command: "reply_comment_public",
        reason: "comment",
        dedupeKey: "reply_comment_public:comment:comment-1",
        extra: {
            public_reply: "Hello",
            private_reply: "In your inbox",
            negative: "0",
            text: "Question",
            connection_id: "connection-1",
        },
    },
]

describe("LeadFlowContinuationService", () => {
    it("scores a captured lead, then runs the steps its input queued", async () => {
        const { continuation, commands, engine } = await build()
        const step = stepOf({ fields: { turn: "t:1", text: "Hello", comment_id: "", psid: "person-1" } })

        await continuation.continue(payloadOf(step, "event-1"))

        expect(commands.sendCommand.mock.calls).toEqual([
            [
                ctx,
                {
                    from: "lead_gen",
                    to: "lead_gen",
                    command: "score_lead",
                    reason: "lead_captured",
                    parentId: "item-1",
                    chainId: "chain-1",
                    inboundEventId: "event-1",
                    dedupeKey: "score_lead:lead-1:t:1",
                    payload: {
                        subject_type: "lead",
                        subject_id: "lead-1",
                        lead_id: "lead-1",
                        turn: "t:1",
                        text: "Hello",
                    },
                },
            ],
        ])
        expect(engine.runInboundQueued).toHaveBeenCalledWith(ctx, "event-1", 10)
    })
    it("asks the next question a score decided, and hands a hot lead to Sales beside it", async () => {
        const { continuation, commands, engine } = await build()
        const fields = {
            step: "ask",
            index: 1,
            question: "When?",
            score: "hot",
            handoff: "1",
            contact: "0912",
            need: "tea",
        }

        await continuation.continue(payloadOf(stepOf({ action: "score_lead", chainId: null, fields })))

        expect(
            commands.sendCommand.mock.calls.map(([, input]) => [input.command, input.dedupeKey, input.chainId]),
        ).toEqual([
            ["handoff_to_sales", "handoff_to_sales:lead-1", "item-1"],
            ["ask_qualifying", "ask_qualifying:lead-1:1", "item-1"],
        ])
        expect(commands.sendCommand.mock.calls[1]?.[1].payload).toEqual({
            subject_type: "lead",
            subject_id: "lead-1",
            lead_id: "lead-1",
            score: "hot",
            index: 1,
            question: "When?",
        })
        expect(engine.runInboundQueued).not.toHaveBeenCalled()
    })
})

describe("LeadFlowContinuationService", () => {
    it("sends the private reply after a public reply to a comment that was not negative", async () => {
        const { continuation, commands } = await build()
        const fields = { comment_id: "comment-1", private_reply: "Check your inbox", connection_id: "connection-1" }

        await continuation.continue(payloadOf(stepOf({ action: "reply_comment_public", fields })))
        await continuation.continue(payloadOf(stepOf({ action: "reply_comment_public", fields: { negative: "1" } })))

        expect(commands.sendCommand.mock.calls.map(([, input]) => [input.command, input.dedupeKey])).toEqual([
            ["private_reply_comment", "private_reply_comment:comment:comment-1"],
        ])
    })
    it("ignores malformed deliveries, missing leads and steps awaiting conversation", async () => {
        const { continuation, commands, engine } = await build()

        await continuation.continue({ workspaceId: "ws-1" })
        await continuation.continue(payloadOf(stepOf({ leadId: null })))
        await continuation.continue(payloadOf(stepOf({ action: "greet_prospect" })))

        expect(commands.sendCommand).not.toHaveBeenCalled()
        expect(engine.runInboundQueued).not.toHaveBeenCalled()
    })
    it("scores a capture with its item id as the turn when none was supplied", async () => {
        const { continuation, commands } = await build()

        await continuation.continue(payloadOf(stepOf({ chainId: null })))

        expect(commands.sendCommand).toHaveBeenCalledWith(ctx, {
            from: "lead_gen",
            to: "lead_gen",
            command: "score_lead",
            reason: "lead_captured",
            parentId: "item-1",
            chainId: "item-1",
            inboundEventId: null,
            dedupeKey: "score_lead:lead-1:item-1",
            payload: { subject_type: "lead", subject_id: "lead-1", lead_id: "lead-1" },
        })
    })
})

describe("LeadFlowContinuationService", () => {
    it.each(continuationCases)(
        "runs the $plan plan chosen by a score",
        async ({ plan, command, reason, dedupeKey, extra }) => {
            const { continuation, commands, engine } = await build()
            const base = {
                turn: "t:2",
                conversation_id: "conv-1",
                reply: "A reply",
                comment_id: "comment-1",
                post_id: "post-1",
                source_kind: "comment",
                score: "warm",
            }
            const fields = {
                ...base,
                step: plan,
                index: null,
                contact: "0912",
                need: "tea",
                public_reply: "Hello",
                private_reply: "In your inbox",
                negative: "0",
                text: "Question",
                connection_id: "connection-1",
            }

            await continuation.continue(payloadOf(stepOf({ action: "score_lead", fields })))

            expect(commands.sendCommand.mock.calls).toEqual([
                [
                    ctx,
                    {
                        from: "lead_gen",
                        to: "lead_gen",
                        command,
                        reason,
                        parentId: "item-1",
                        chainId: "chain-1",
                        inboundEventId: null,
                        dedupeKey,
                        payload: {
                            subject_type: "lead",
                            subject_id: "lead-1",
                            lead_id: "lead-1",
                            ...(plan === "handoff" ? {} : base),
                            ...extra,
                        },
                    },
                ],
            ])
            expect(engine.runInboundQueued).not.toHaveBeenCalled()
        },
    )
})

describe("LeadFlowContinuationService", () => {
    it("sends a negative comment's public reply without a private reply plan", async () => {
        const { continuation, commands } = await build()

        await continuation.continue(
            payloadOf(
                stepOf({ action: "score_lead", fields: { step: "comment", negative: "1", comment_id: "comment-1" } }),
            ),
        )

        expect(commands.sendCommand.mock.calls).toEqual([
            [
                ctx,
                {
                    from: "lead_gen",
                    to: "lead_gen",
                    command: "reply_comment_public",
                    reason: "negative_comment",
                    parentId: "item-1",
                    chainId: "chain-1",
                    inboundEventId: null,
                    dedupeKey: "reply_comment_public:comment:comment-1",
                    payload: {
                        subject_type: "lead",
                        subject_id: "lead-1",
                        lead_id: "lead-1",
                        comment_id: "comment-1",
                        score: "",
                        negative: "1",
                        connection_id: "",
                    },
                },
            ],
        ])
    })
    it("waits for a message when scoring has no next plan, and still drains the input", async () => {
        const { continuation, commands, engine } = await build()

        await continuation.continue(payloadOf(stepOf({ action: "score_lead", fields: {} }), "event-1"))

        expect(commands.sendCommand).not.toHaveBeenCalled()
        expect(engine.runInboundQueued).toHaveBeenCalledWith(ctx, "event-1", 10)
    })
})
