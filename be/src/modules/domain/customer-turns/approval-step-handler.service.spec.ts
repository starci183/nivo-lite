import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentRunHandlersService } from "@modules/domain/agent-runs"
import type { StepView } from "@modules/domain/agent-runs"
import { ApprovalStepHandlerService } from "./approval-step-handler.service"
import { approvalSpecOf } from "./output-steps.policy"

const DEADLINE = "2026-11-04T00:00:00.000Z"
const VIEW = mock<StepView>()
Object.assign(
    VIEW,
    approvalSpecOf({
        workItemId: "w1",
        deadlineAt: DEADLINE,
        calls: [{ tool: "orders.draft", argsJson: "{}" }],
        scope: {
            conversationId: "c1",
            messageId: "m1",
            approvedBy: null,
            workItemId: null,
            planned: "",
            declined: false,
            outputNode: "act:gateway_call",
            approvalNode: "ask:gateway_call",
            replyNode: "act:reply_customer",
        },
    }),
)

const build = async () => {
    const handlers = mock<AgentRunHandlersService>()
    const moduleRef = await Test.createTestingModule({
        providers: [ApprovalStepHandlerService, { provide: AgentRunHandlersService, useValue: handlers }],
    }).compile()
    return { handler: moduleRef.get(ApprovalStepHandlerService), handlers }
}

describe("ApprovalStepHandlerService", () => {
    it("registers the approval kind with its exact implementation", async () => {
        const { handler, handlers } = await build()
        handler.onModuleInit()
        expect(handler.kind).toBe("approval")
        expect(handlers.add).toHaveBeenCalledWith(handler)
    })

    it("waits on the work item of the row", async () => {
        const { handler } = await build()
        await expect(handler.run(VIEW)).resolves.toEqual({
            kind: "wait",
            workItemId: "w1",
            deadlineAt: new Date(DEADLINE),
        })
    })

    it("writes the output step when a person approves", async () => {
        const { handler } = await build()
        expect(handler.onDecided(VIEW, { approved: true, by: "An" })).toMatchObject({
            kind: "done",
            next: [{ stepKey: "output:w1:0:orders.draft", input: { scope: { approvedBy: "An" } } }],
        })
    })

    it("runs the edited quantity and reply from the durable approved proposal", async () => {
        const { handler } = await build()
        expect(
            handler.onDecided(VIEW, {
                approved: true,
                by: "member-1",
                data: { fields: { tool: "orders.draft", args_json: '{"qty":1}' }, draft: "One order" },
            }),
        ).toMatchObject({
            kind: "done",
            next: [
                {
                    stepKey: "output:w1:0:orders.draft",
                    input: { argsJson: '{"qty":1}', scope: { approvedBy: "member-1", planned: "One order" } },
                },
            ],
        })
    })

    it("refuses malformed approved replay data rather than running the original calls", async () => {
        const { handler } = await build()
        expect(
            handler.onDecided(VIEW, {
                approved: true,
                by: "member-1",
                data: { fields: { tool: "orders.draft", args_json: "[]" }, draft: "One order" },
            }),
        ).toEqual({ kind: "failed", code: "invalid_input" })
    })

    it("runs nothing for an approved decision whose recorded principal is missing", async () => {
        const { handler } = await build()
        expect(handler.onDecided(VIEW, { approved: true, by: null })).toEqual({
            kind: "failed",
            code: "decision_actor_unknown",
        })
    })

    it.each(["An", "timeout"])("runs nothing and owes the neutral reply when %s ends it", async (by) => {
        const { handler } = await build()
        expect(handler.onDecided(VIEW, { approved: false, by })).toMatchObject({
            kind: "done",
            result: { approved: false, by },
            next: [{ kind: "final_reply", input: { declined: true, workItemId: "w1", planned: "" } }],
        })
    })
})

describe("ApprovalStepHandlerService malformed persisted input", () => {
    it("refuses a malformed wait both before waiting and after a decision without producing follow-up steps", async () => {
        const { handler } = await build()
        const broken = mock<StepView>({ input: {} })
        await expect(handler.run(broken)).resolves.toEqual({ kind: "failed", code: "invalid_input" })
        expect(handler.onDecided(broken, { approved: true, by: "member-1" })).toEqual({
            kind: "failed",
            code: "invalid_input",
        })
    })
})
