import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { QUEUE_TIMEOUT } from "@modules/platform/queue"
import type { QueueTimeout } from "@modules/platform/queue"
import { McpGatewayError, McpGatewayErrorCode } from "./errors/mcp-gateway.error"
import type { GatewayCaller, NativeAdapter } from "./mcp-gateway.contracts"
import { NativeRunnerService } from "./native-runner.service"

const CALLER: GatewayCaller = { workspaceId: "ws-1", agentId: "sales", conversationId: "conv-1", workItemId: null }

const build = async () => {
    const timeout = mock<QueueTimeout>()
    const cancel = jest.fn()
    timeout.schedule.mockReturnValue(cancel)
    const adapter = mock<NativeAdapter>()
    adapter.invoke.mockResolvedValue({ transactions: [] })
    const moduleRef = await Test.createTestingModule({
        providers: [NativeRunnerService, { provide: QUEUE_TIMEOUT, useValue: timeout }],
    }).compile()
    return { runner: moduleRef.get(NativeRunnerService), timeout, cancel, adapter }
}

const refused = (params: Record<string, string>) =>
    new McpGatewayError({ code: McpGatewayErrorCode.NativeRefused, params })

describe("NativeRunnerService.run", () => {
    it("runs the adapter for the caller under the time limit and releases the deadline", async () => {
        const { runner, timeout, cancel, adapter } = await build()

        await expect(runner.run(adapter, CALLER, "transactions.list", 4000, { limit: 5 })).resolves.toEqual({
            kind: "ok",
            value: { transactions: [] },
        })

        expect(adapter.invoke).toHaveBeenCalledWith(
            "ws-1",
            "transactions.list",
            { limit: 5 },
            { agentId: "sales", conversationId: "conv-1" },
        )
        expect(timeout.schedule.mock.calls[0]?.[1]).toBe(4000)
        expect(cancel).toHaveBeenCalledTimes(1)
    })

    it("answers an expected refusal of the adapter as a tool error with its reason", async () => {
        const { runner, cancel, adapter } = await build()
        adapter.invoke.mockRejectedValueOnce(refused({ reason: "not_connected" }))
        adapter.invoke.mockRejectedValueOnce(refused({}))

        await expect(runner.run(adapter, CALLER, "status", 4000, {})).resolves.toEqual({
            kind: "tool_error",
            value: { error: "not_connected" },
        })
        await expect(runner.run(adapter, CALLER, "status", 4000, {})).resolves.toEqual({
            kind: "tool_error",
            value: { error: "refused" },
        })
        expect(cancel).toHaveBeenCalledTimes(2)
    })

    it("throws any other failure of the adapter, a domain error or not", async () => {
        const { runner, adapter, cancel } = await build()
        const failure = new McpGatewayError({ code: McpGatewayErrorCode.UnknownTool })
        adapter.invoke.mockRejectedValue(failure)

        await expect(runner.run(adapter, CALLER, "status", 4000, {})).rejects.toBe(failure)
        const plain = new Error("down")
        adapter.invoke.mockRejectedValue(plain)
        await expect(runner.run(adapter, CALLER, "status", 4000, {})).rejects.toBe(plain)
        expect(cancel).toHaveBeenCalledTimes(2)
    })

    it("throws MCP_GATEWAY_TIMEOUT when the adapter outlasts the time limit", async () => {
        const { runner, timeout, cancel, adapter } = await build()
        adapter.invoke.mockReturnValue(new Promise(() => undefined))
        timeout.schedule.mockImplementation((expire) => {
            expire()
            return cancel
        })

        await expect(runner.run(adapter, CALLER, "status", 10, {})).rejects.toMatchObject({
            code: McpGatewayErrorCode.Timeout,
            params: { tool: "status" },
        })
        expect(cancel).toHaveBeenCalledTimes(1)
    })
})
