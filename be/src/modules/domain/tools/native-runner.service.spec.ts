import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { QUEUE_TIMEOUT } from "@modules/platform/queue"
import type { QueueTimeout } from "@modules/platform/queue"
import { ToolsError, ToolsErrorCode } from "./errors/tools.error"
import type { ToolCaller, NativeToolFamily } from "./tools.contracts"
import { NativeRunnerService } from "./native-runner.service"
import { reaskSeenOf } from "./node-rule.policy"

const CALLER: ToolCaller = { workspaceId: "ws-1", agentId: "sales", conversationId: "conv-1", workItemId: null }

const build = async () => {
    const timeout = mock<QueueTimeout>()
    const cancel = jest.fn()
    timeout.schedule.mockReturnValue(cancel)
    const adapter = mock<NativeToolFamily>()
    adapter.invoke.mockResolvedValue({ transactions: [] })
    const moduleRef = await Test.createTestingModule({
        providers: [NativeRunnerService, { provide: QUEUE_TIMEOUT, useValue: timeout }],
    }).compile()
    return { runner: moduleRef.get(NativeRunnerService), timeout, cancel, adapter }
}

const refused = (params: Record<string, string>) =>
    new ToolsError({ code: ToolsErrorCode.NativeRefused, params })

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

    it("tells the adapter when the call is a workflow step", async () => {
        const { runner, adapter } = await build()

        await runner.run(adapter, { ...CALLER, graphStep: true }, "transactions.list", 4000, {})

        expect(adapter.invoke.mock.calls[0]?.[3]).toEqual({ agentId: "sales", conversationId: "conv-1", graphStep: true })

        await runner.run(adapter, { ...CALLER, conversationId: null, engine: true }, "transactions.list", 4000, {})
        expect(adapter.invoke.mock.calls[1]?.[3]).toEqual({ agentId: "sales", conversationId: null, engine: true })
    })

    it("hands the adapter the member who approved an approved replay, none for a call nobody approved, and never one the arguments name", async () => {
        const { runner, adapter } = await build()

        await runner.run(adapter, { ...CALLER, approvedBy: "member-owner" }, "transactions.list", 4000, {})
        await runner.run(adapter, CALLER, "transactions.list", 4000, { approvedBy: "member-forged" })

        // The approved replay carries the member; nothing else of the caller changes.
        expect(adapter.invoke.mock.calls[0]?.[3]).toEqual({ agentId: "sales", conversationId: "conv-1", approvedBy: "member-owner" })
        // An unapproved call carries none, whatever its arguments say (they are handed on as arguments only).
        expect(adapter.invoke.mock.calls[1]?.[3]).toEqual({ agentId: "sales", conversationId: "conv-1" })
        expect(adapter.invoke.mock.calls[1]?.[2]).toEqual({ approvedBy: "member-forged" })
    })

    it("hands the adapter the member a declared job names as the one who typed what it says, none otherwise", async () => {
        const { runner, adapter } = await build()

        await runner.run(adapter, { ...CALLER, byMember: "member-1" }, "transactions.list", 4000, {})
        await runner.run(adapter, CALLER, "transactions.list", 4000, {})

        expect(adapter.invoke.mock.calls[0]?.[3]).toEqual({ agentId: "sales", conversationId: "conv-1", byMember: "member-1" })
        expect(adapter.invoke.mock.calls[1]?.[3]).toEqual({ agentId: "sales", conversationId: "conv-1" })
    })

    it("hands the adapter the part the run plays for its provider trigger, so an adapter's own question about the rights states a notice run", async () => {
        const { runner, adapter } = await build()
        const node = { nodeKey: "ledger", versionId: "v-6", workflowId: "wf-1" }

        await runner.run(adapter, { ...CALLER, origin: "node", node, triggerRole: "notice" }, "transactions.list", 4000, {})
        await runner.run(adapter, { ...CALLER, origin: "node", node }, "transactions.list", 4000, {})

        const [first, second] = adapter.invoke.mock.calls.map((call) => call[3])
        expect(first).toEqual({ agentId: "sales", conversationId: "conv-1", origin: "node", node, triggerRole: "notice" })
        expect(first === undefined ? undefined : reaskSeenOf(first)).toEqual({ origin: "adapter_reask", node, triggerRole: "notice" })
        expect(second).toEqual({ agentId: "sales", conversationId: "conv-1", origin: "node", node })
    })
})

describe("NativeRunnerService.run: the failures of the adapter", () => {
    it("answers an expected refusal of the adapter as a tool error with its reason", async () => {
        const { runner, cancel, adapter } = await build()
        adapter.invoke.mockRejectedValueOnce(refused({ reason: "not_connected" }))
        adapter.invoke.mockRejectedValueOnce(refused({}))

        await expect(runner.run(adapter, CALLER, "status", 4000, {})).resolves.toEqual({
            kind: "tool_error",
            value: { error: "not_connected" },
            nativeRefusal: "not_connected",
        })
        await expect(runner.run(adapter, CALLER, "status", 4000, {})).resolves.toEqual({
            kind: "tool_error",
            value: { error: "refused" },
        })
        expect(cancel).toHaveBeenCalledTimes(2)
    })

    it("names the reason of a refusal its source classed business, and only of such a refusal", async () => {
        const { runner, adapter } = await build()
        adapter.invoke.mockRejectedValueOnce(refused({ reason: "other_lead", refusalClass: "business" }))
        adapter.invoke.mockRejectedValueOnce(refused({ reason: "not_connected", refusalClass: "infrastructure" }))

        await expect(runner.run(adapter, CALLER, "status", 4000, {})).resolves.toEqual({
            kind: "tool_error",
            value: { error: "other_lead" },
            refused: "other_lead",
            nativeRefusal: "other_lead",
        })
        await expect(runner.run(adapter, CALLER, "status", 4000, {})).resolves.toEqual({
            kind: "tool_error",
            value: { error: "not_connected" },
            nativeRefusal: "not_connected",
        })
    })

    it("throws any other failure of the adapter, a domain error or not", async () => {
        const { runner, adapter, cancel } = await build()
        const failure = new ToolsError({ code: ToolsErrorCode.UnknownTool })
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
            code: ToolsErrorCode.Timeout,
            params: { tool: "status" },
        })
        expect(cancel).toHaveBeenCalledTimes(1)
    })
})

// #10a: the typed reason of every native refusal rides on the run (`nativeRefusal`), whatever its class, so no reader parses words.
describe("NativeRunnerService.run: the typed reason of a refusal", () => {
    it("carries the reason of every refusal thrown with a text reason, and none for one thrown without", async () => {
        const { runner, adapter } = await build()
        adapter.invoke.mockRejectedValueOnce(refused({ reason: "connection_refused", refusalClass: "infrastructure" }))
        adapter.invoke.mockRejectedValueOnce(refused({ reason: "other_lead", refusalClass: "business" }))
        adapter.invoke.mockRejectedValueOnce(refused({}))

        await expect(runner.run(adapter, CALLER, "status", 4000, {})).resolves.toMatchObject({
            nativeRefusal: "connection_refused",
        })
        await expect(runner.run(adapter, CALLER, "status", 4000, {})).resolves.toMatchObject({
            nativeRefusal: "other_lead",
            refused: "other_lead",
        })
        await expect(runner.run(adapter, CALLER, "status", 4000, {})).resolves.not.toHaveProperty("nativeRefusal")
    })
})
