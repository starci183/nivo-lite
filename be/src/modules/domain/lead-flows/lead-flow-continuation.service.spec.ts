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
    origin: "live",
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
                    origin: "live",
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

    it("sends the private reply after a public reply to a comment that was not negative", async () => {
        const { continuation, commands } = await build()
        const fields = { comment_id: "comment-1", private_reply: "Check your inbox", connection_id: "connection-1" }

        await continuation.continue(payloadOf(stepOf({ action: "reply_comment_public", fields })))
        await continuation.continue(payloadOf(stepOf({ action: "reply_comment_public", fields: { negative: "1" } })))

        expect(commands.sendCommand.mock.calls.map(([, input]) => [input.command, input.dedupeKey])).toEqual([
            ["private_reply_comment", "private_reply_comment:comment:comment-1"],
        ])
    })

    it("does nothing for a delivery of another shape, a step without a lead, or a step the conversation waits after", async () => {
        const { continuation, commands, engine } = await build()

        await continuation.continue({ workspaceId: "ws-1" })
        await continuation.continue(payloadOf(stepOf({ leadId: null })))
        await continuation.continue(payloadOf(stepOf({ action: "greet_prospect" })))

        expect(commands.sendCommand).not.toHaveBeenCalled()
        expect(engine.runInboundQueued).not.toHaveBeenCalled()
    })
})
