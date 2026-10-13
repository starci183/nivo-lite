import type { CommandBus } from "@nestjs/cqrs"
import { mock } from "@starci/jest-preset"
import type { Principal } from "@modules/platform/cqrs"
import { RunFlowCommand } from "../../application/run-flow.command"
import { FlowsController } from "./flows.controller"
import type { RunFlowRequest } from "./dto/run-flow.request"

const PRINCIPAL: Principal = { id: "user-1", email: "owner@example.test", role: "authenticated" }

describe("FlowsController", () => {
    it("dispatches the mapped flow and returns the mapped answer", async () => {
        const commandBus = mock<CommandBus>()
        const controller = new FlowsController(commandBus)
        const input: RunFlowRequest = { kind: "assign", payload: { workItemId: "work-1", staffId: "staff-1" } }
        commandBus.execute.mockResolvedValue({ data: { id: "work-1", staffId: "staff-1" } })

        await expect(controller.run(PRINCIPAL, "workspace-1", input)).resolves.toEqual({
            data: { id: "work-1", staffId: "staff-1" },
        })

        expect(commandBus.execute).toHaveBeenCalledTimes(1)
        expect(commandBus.execute).toHaveBeenCalledWith(
            new RunFlowCommand({
                principal: { id: "user-1", email: "owner@example.test", role: "authenticated" },
                request: {
                    workspaceId: "workspace-1",
                    flow: { kind: "assign", payload: { workItemId: "work-1", staffId: "staff-1" } },
                },
            }),
        )
    })

    it("propagates a rejected command", async () => {
        const commandBus = mock<CommandBus>()
        const controller = new FlowsController(commandBus)
        const failure = new Error("Command rejected")
        commandBus.execute.mockRejectedValue(failure)

        await expect(controller.run(PRINCIPAL, "workspace-1", { kind: "hold", payload: {} })).rejects.toBe(failure)

        expect(commandBus.execute).toHaveBeenCalledTimes(1)
        expect(commandBus.execute).toHaveBeenCalledWith(
            new RunFlowCommand({
                principal: { id: "user-1", email: "owner@example.test", role: "authenticated" },
                request: { workspaceId: "workspace-1", flow: { kind: "hold", payload: {} } },
            }),
        )
    })
})
