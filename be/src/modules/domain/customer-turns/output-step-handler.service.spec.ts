import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentRunHandlersService } from "@modules/domain/agent-runs"
import type { StepView } from "@modules/domain/agent-runs"
import { McpGatewayService } from "@modules/domain/mcp-gateway"
import { OutputStepHandlerService } from "./output-step-handler.service"
import { outputSpecOf } from "./output-steps.policy"
import type { OutputCall, OutputScope } from "./output-steps.schema"

const SCOPE: OutputScope = {
    conversationId: "c1",
    messageId: "m1",
    approvedBy: null,
    workItemId: null,
    planned: "",
    declined: false,
    outputNode: "act:gateway_call",
    approvalNode: "ask:gateway_call",
    replyNode: "act:reply_customer",
}
const CALL: OutputCall = { stepKey: "output:a.b:1", tool: "a.b", argsJson: '{"x":1}', opKey: "m1:a.b:1" }
const NEXT: OutputCall = { stepKey: "output:w1:1:c.d", tool: "c.d", argsJson: "{}", opKey: "w1:1:c.d" }

const viewOf = (scope: OutputScope, rest: ReadonlyArray<OutputCall> = []): StepView => {
    const view = mock<StepView>()
    Object.assign(view, outputSpecOf(CALL, rest, scope), { workspaceId: "ws", agentId: "a1", earlier: {} })
    return view
}

const build = async () => {
    const gateway = mock<McpGatewayService>({
        call: jest.fn().mockResolvedValue({ ok: true, value: { id: 1 }, summary: '{"id":1}' }),
    })
    const handlers = mock<AgentRunHandlersService>({ add: jest.fn() })
    const moduleRef = await Test.createTestingModule({
        providers: [
            OutputStepHandlerService,
            { provide: McpGatewayService, useValue: gateway },
            { provide: AgentRunHandlersService, useValue: handlers },
        ],
    }).compile()
    return { handler: moduleRef.get(OutputStepHandlerService), gateway, handlers }
}

describe("OutputStepHandlerService", () => {
    it("registers its kind", async () => {
        const { handler, handlers } = await build()
        handler.onModuleInit()
        expect(handler.kind).toBe("output")
        expect(handlers.add).toHaveBeenCalledWith(handler)
    })

    it("calls the tool under the replay key of the row and leaves the masked result", async () => {
        const { handler, gateway } = await build()
        await expect(handler.run(viewOf(SCOPE))).resolves.toMatchObject({
            kind: "done",
            result: { tool: "a.b", status: "ok", summary: '{"id":1}' },
            next: [],
        })
        expect(gateway.call).toHaveBeenCalledWith(
            expect.objectContaining({ opKey: "m1:a.b:1", workItemId: null }),
            "a.b",
            {
                x: 1,
            },
        )
    })

    it("goes forward to the reply when the tool refused, because the customer is owed the truth", async () => {
        const { handler, gateway } = await build()
        gateway.call.mockResolvedValue({ ok: false, code: "tool_error", detail: "full" })
        const approved = { ...SCOPE, workItemId: "w1", approvedBy: "An" }
        await expect(handler.run(viewOf(approved, [NEXT]))).resolves.toMatchObject({
            kind: "done",
            result: { status: "failed", code: "tool_error" },
            next: [{ kind: "final_reply" }],
        })
    })

    it("runs the next call of an approved sequence while each one ran, as the person who approved", async () => {
        const { handler, gateway } = await build()
        const approved = { ...SCOPE, workItemId: "w1", approvedBy: "An" }
        await expect(handler.run(viewOf(approved, [NEXT]))).resolves.toMatchObject({
            next: [{ stepKey: "output:w1:1:c.d", kind: "output" }],
        })
        expect(gateway.call).toHaveBeenCalledWith(expect.objectContaining({ approvedBy: "An" }), "a.b", { x: 1 })
    })

    it("gives an unsealed receipt to a person and never calls again", async () => {
        const { handler, gateway } = await build()
        gateway.call.mockResolvedValue({ ok: false, code: "unknown_outcome", detail: "operation_pending" })
        await expect(handler.run(viewOf(SCOPE))).resolves.toEqual({ kind: "failed", code: "tool_outcome_unknown" })
    })

    it("fails a row that holds no call", async () => {
        const { handler, gateway } = await build()
        const broken = viewOf(SCOPE)
        Object.assign(broken, { input: {} })
        await expect(handler.run(broken)).resolves.toEqual({ kind: "failed", code: "invalid_input" })
        expect(gateway.call).not.toHaveBeenCalled()
    })
})

describe("OutputStepHandlerService malformed call arguments", () => {
    it.each(["not json", "[]"])("refuses %s before the connector can execute", async (argsJson) => {
        const { handler, gateway } = await build()
        const broken = viewOf(SCOPE)
        Object.assign(broken, outputSpecOf({ ...CALL, argsJson }, [], SCOPE))
        await expect(handler.run(broken)).resolves.toEqual({ kind: "failed", code: "invalid_input" })
        expect(gateway.call).not.toHaveBeenCalled()
    })
})
