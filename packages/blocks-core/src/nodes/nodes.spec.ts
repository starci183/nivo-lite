import { runNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { EXAMPLE_TURN, fakeNodePorts } from "@nivo-lite/agent-sdk/testing"
import type { FakeNodePortsOptions } from "@nivo-lite/agent-sdk/testing"
import { BlocksError } from "../blocks-error"
import { coreEffects, coreTools } from "../vocabulary"
import { coreNodes } from "./core-nodes"
import { raiseWorkItemNode } from "./core/raise-work-item.node"
import { orderConfirmNode } from "./order/confirm.node"
import { orderNeedsApprovalNode } from "./order/needs-approval.node"
import { paymentRequestNode } from "./payment/request.node"

// The worked examples of every node run in the root conformance spec; these cover what an example cannot say.

describe("coreNodes", () => {
    it("keeps the conditions pure: they route on a branch and declare no effect", () => {
        const conditions = coreNodes.filter((node) => node.role === "condition")

        expect(conditions.map((node) => node.id)).toEqual(
            expect.arrayContaining(["order.complete", "order.needs-approval", "payment.match-code", "payment.judge"]),
        )
        expect(conditions.every((node) => node.effects.length === 0)).toBe(true)
    })
})

describe("order.needs-approval", () => {
    it("defaults the threshold to 5,000,000 VND", () => {
        expect(orderNeedsApprovalNode.params.parse({})).toEqual({ thresholdVnd: 5_000_000 })
    })
})

/** Runs one node as the host does, over fake ports: rights, declarations and payloads are enforced by the runner. */
const runOver = (
    node: NodeDefinition,
    input: unknown,
    options: FakeNodePortsOptions,
    override: (ports: ReturnType<typeof fakeNodePorts>["ports"]) => ReturnType<typeof fakeNodePorts>["ports"] = (
        ports,
    ) => ports,
) => {
    const fake = fakeNodePorts(options)
    return runNode(
        {
            node,
            params: {},
            input,
            turn: EXAMPLE_TURN,
            grant: {
                rights: [
                    ...node.rights,
                    ...coreEffects.flatMap((effect) => effect.rights),
                    ...coreTools.flatMap((tool) => tool.rights),
                ],
                tools: coreTools.map((tool) => tool.id),
            },
            effects: new Map(coreEffects.map((effect) => [effect.id, effect])),
            tools: new Map(coreTools.map((tool) => [tool.id, tool])),
            key: `${node.id}:spec`,
        },
        override(fake.ports),
    ).then((run) => ({ ...run, executed: fake.executed, toolCalls: fake.toolCalls }))
}

describe("order.confirm", () => {
    it("confirms once per order across runs: the dedupe key is the order", async () => {
        const { executed } = await runOver(orderConfirmNode, { orderId: "o1" }, {})

        expect(executed.map((one) => [one.id, one.payload, one.dedupeKey])).toEqual([
            ["order.confirm", { orderId: "o1" }, "order-confirm:o1"],
        ])
    })
})

describe("core.raise-work-item", () => {
    it("takes the action and the title from the params", () => {
        expect(raiseWorkItemNode.params.safeParse({ action: "Bad Action", title: "x" }).success).toBe(false)
        expect(raiseWorkItemNode.params.safeParse({ action: "confirm_order", title: "x" }).success).toBe(true)
    })
})

describe("payment.request", () => {
    /** The order as the sales record keeps it: `items` is an object that holds the lines. */
    const order = {
        id: "o1",
        orderNo: "DH-20261105-0001",
        amountVnd: 300_000,
        status: "confirmed",
        items: { lines: [{ name: "tea", qty: 2, unitVnd: 150_000, amountVnd: 300_000 }] },
    }
    const instruction = {
        bankName: "",
        bankCode: "MBBank",
        accountNumber: "525209999",
        accountHolder: "",
        qrUrl: "https://qr.example/x",
        provider: "sepay",
    }
    const input = { orderId: "o1", conversationId: "conv-1", locale: "en" }

    const run = (tools: ReadonlyArray<unknown>, failure: BlocksError<string> | null = null) =>
        runOver(paymentRequestNode, input, { store: { order: [order] }, tools }, (ports) =>
            failure === null ? ports : { ...ports, callTool: () => Promise.reject(failure) },
        )

    it("declares the tool it calls and reads the order only: the rights of its effect and tool are the grant", () => {
        expect(paymentRequestNode.tools).toEqual(["payment.instruction"])
        expect(paymentRequestNode.rights.map((right) => right.kind)).toEqual(["order"])
    })

    it("asks the tool with the order number, the amount and the transfer content, then sends once per order", async () => {
        const { output, executed, toolCalls } = await run([instruction])

        expect(toolCalls.map((call) => [call.id, call.args])).toEqual([
            [
                "payment.instruction",
                { orderNo: "DH-20261105-0001", amountVnd: 300_000, transferContent: "DH202611050001" },
            ],
        ])
        expect(output).toEqual({ status: "sent", content: "DH202611050001", qrUrl: "https://qr.example/x" })
        expect(executed.map((one) => one.id)).toEqual(["channel.send", "payment.rematch"])
        expect(String(executed[0]?.payload.text)).toContain("Bank: MBBank")
        expect(String(executed[0]?.payload.text)).toContain("2 x tea")
        expect(executed[0]?.dedupeKey).toBe("payment-request:o1")
        expect(executed[1]?.payload).toEqual({ orderId: "o1" })
        expect(executed[1]?.dedupeKey).toBe("payment-rematch:o1")
    })

    it("tells the customer the order is recorded and raises a connect_sepay work item when the tool fails, naming the kind of the failure", async () => {
        const { output, executed } = await run([], new BlocksError("GRAPH_NODES_TOOL_FAILED", "payment.instruction"))

        expect(output).toEqual({ status: "no_account", content: null, qrUrl: null })
        expect(executed.map((one) => one.id)).toEqual(["channel.send", "work-item.raise"])
        expect(executed[0]?.dedupeKey).toBe("order-held:o1")
        expect(String(executed[0]?.payload.text)).toContain("recorded your order: 2 x tea")
        expect(String(executed[0]?.payload.text)).not.toContain("Bank:")
        expect(executed[1]?.payload).toMatchObject({
            action: "connect_sepay",
            payload: { orderId: "o1", failure: "BlocksError" },
        })
    })
})
