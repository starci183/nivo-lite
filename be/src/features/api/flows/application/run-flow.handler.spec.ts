import { mock } from "@starci/jest-preset"
import type { FlowsService, FlowResult } from "@modules/domain/flows"
import type { Principal } from "@modules/platform/cqrs"
import type { Logger } from "@modules/platform/logging"
import { RunFlowCommand } from "./run-flow.command"
import { RunFlowHandler } from "./run-flow.handler"

const PRINCIPAL: Principal = { id: "user-1", email: "owner@example.test", role: "authenticated" }

describe("RunFlowHandler", () => {
    it("runs the requested flow for the caller in the requested workspace", async () => {
        const logger = mock<Logger>()
        const flows = mock<FlowsService>()
        const handler = new RunFlowHandler(logger, flows)
        const flow = { kind: "hold", payload: { workItemId: "work-1", reason: "Waiting for payment" } }
        const command = new RunFlowCommand({
            principal: PRINCIPAL,
            request: {
                workspaceId: "workspace-1",
                flow: { kind: "hold", payload: flow.payload },
            },
        })
        const result: FlowResult = { data: { id: "work-1", status: "held" } }
        flows.run.mockResolvedValue(result)

        await expect(handler.execute(command)).resolves.toEqual({ data: { id: "work-1", status: "held" } })

        expect(flows.run).toHaveBeenCalledTimes(1)
        expect(flows.run).toHaveBeenCalledWith("user-1", "workspace-1", {
            kind: "hold",
            payload: { workItemId: "work-1", reason: "Waiting for payment" },
        })
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("logs and propagates a flow failure", async () => {
        const logger = mock<Logger>()
        const flows = mock<FlowsService>()
        const handler = new RunFlowHandler(logger, flows)
        const command = new RunFlowCommand({
            principal: PRINCIPAL,
            request: { workspaceId: "workspace-1", flow: { kind: "decide", payload: { workItemId: "work-1" } } },
        })
        const failure = new Error("Flow refused the decision")
        flows.run.mockRejectedValue(failure)

        await expect(handler.execute(command)).rejects.toBe(failure)

        expect(flows.run).toHaveBeenCalledTimes(1)
        expect(flows.run).toHaveBeenCalledWith("user-1", "workspace-1", {
            kind: "decide",
            payload: { workItemId: "work-1" },
        })
        expect(logger.error).toHaveBeenCalledTimes(1)
        expect(logger.error).toHaveBeenCalledWith("cqrs.operation.failed", failure, {
            operation: "RunFlowHandler",
        })
    })
})
