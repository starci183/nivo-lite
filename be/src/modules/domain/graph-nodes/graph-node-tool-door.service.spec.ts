import { mock } from "@starci/jest-preset"
import { McpGatewayService } from "@modules/domain/mcp-gateway"
import { GraphNodesErrorCode } from "./errors/graph-nodes.error"
import { GraphNodeToolDoorService } from "./graph-node-tool-door.service"
import type { NodeTurn } from "./graph-nodes.contracts"

const TURN: NodeTurn = {
    turnId: "turn-1",
    workspaceId: "ws-1",
    agentId: "agent-1",
    subject: null,
    conversationId: "conv-1",
    locale: "vi",
}
const ARGS = { orderNo: "DH-7", amountVnd: 5000, transferContent: "DH7 thanh toan" }

const build = () => {
    const gateway = mock<McpGatewayService>()
    return { door: new GraphNodeToolDoorService(gateway), gateway }
}

describe("GraphNodeToolDoorService call", () => {
    it("runs the capability tool through the gateway as the turn agent under the replay key and answers its value", async () => {
        const { door, gateway } = build()
        const value = { provider: "sepay", qrUrl: "https://qr.example/img" }
        gateway.call.mockResolvedValue({ ok: true, value })

        await expect(door.call(TURN, "payment.instruction", ARGS, "step-1")).resolves.toEqual(value)

        expect(gateway.call).toHaveBeenCalledWith(
            { workspaceId: "ws-1", agentId: "agent-1", conversationId: "conv-1", workItemId: null, opKey: "step-1" },
            "payment.instruction",
            ARGS,
        )
    })

    it("answers the typed not-connected error when the workspace has no provider for the capability", async () => {
        const { door, gateway } = build()
        gateway.call.mockResolvedValue({ ok: false, code: "tool_error", detail: '{"error":"not_connected"}' })

        await expect(door.call(TURN, "payment.instruction", ARGS, "step-1")).rejects.toMatchObject({
            code: GraphNodesErrorCode.ToolNotConnected,
            params: { tool: "payment.instruction" },
        })
    })

    it.each([
        ["another tool error", { ok: false, code: "tool_error", detail: '{"error":"internal_only"}' }, "tool_error"],
        ["a grant it lacks", { ok: false, code: "not_granted", detail: "" }, "not_granted"],
        ["an approval it waits for", { ok: false, code: "approval_required", reason: "write" }, "approval_required"],
    ] as const)("fails with the reason for %s", async (_name, result, reason) => {
        const { door, gateway } = build()
        gateway.call.mockResolvedValue(result as never)

        await expect(door.call(TURN, "bank.transactions", {}, "step-1")).rejects.toMatchObject({
            code: GraphNodesErrorCode.ToolFailed,
            params: { tool: "bank.transactions", reason },
        })
    })

    it("refuses arguments that are not a bounded JSON record before it calls the gateway", async () => {
        const { door, gateway } = build()

        await expect(door.call(TURN, "bank.transactions", { at: () => 1 }, "step-1")).rejects.toMatchObject({
            code: GraphNodesErrorCode.ToolFailed,
            params: { reason: "invalid_arguments" },
        })
        expect(gateway.call).not.toHaveBeenCalled()
    })
})
