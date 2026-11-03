import { defineEffect } from "@nivo-lite/agent-sdk/node"
import type { NodeContext, NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { nodeListMismatches } from "@nivo-lite/agent-sdk/testing"
import { z } from "zod"
import {
    coreNodes,
    orderConfirmNode,
    orderNeedsApprovalNode,
    paymentRequestNode,
    raiseWorkItemNode,
} from "./index"

// The effects the nodes run, with loose payloads; the vocabulary commit brings the real definitions (coreEffects).
const effects = ["channel.send", "order.record", "order.confirm", "work-item.raise"].map((id) =>
    defineEffect({ id: id as `${string}.${string}`, title: { key: id }, payload: z.looseObject({}), rights: [] }),
)

/** The example of payment.request that needs the tools port, which the SDK host does not give yet: run by hand below. */
const NEEDS_TOOLS = "sends the order number as the transfer content with the account and QR link the provider tool gave"

const conforming = (node: NodeDefinition): NodeDefinition => ({
    ...node,
    examples: node.examples.filter((example) => example.name !== NEEDS_TOOLS) as unknown as NodeDefinition["examples"],
})

describe("coreNodes", () => {
    it("lists the seven nodes by id, in the order the graph runs them", () => {
        expect(coreNodes.map((node) => node.id)).toEqual([
            "order.record",
            "order.complete",
            "order.ask-missing",
            "order.needs-approval",
            "order.confirm",
            "core.raise-work-item",
            "payment.request",
        ])
    })

    it("keeps the conditions pure: they route on a branch and declare no effect", () => {
        const conditions = coreNodes.filter((node) => node.role === "condition")

        expect(conditions.map((node) => node.id)).toEqual(["order.complete", "order.needs-approval"])
        expect(conditions.every((node) => node.effects.length === 0)).toBe(true)
    })

    it("runs every worked example to its output and effects", async () => {
        await expect(nodeListMismatches(coreNodes.map(conforming), effects)).resolves.toEqual({})
    })
})

describe("order.needs-approval", () => {
    it("defaults the threshold to 5,000,000 VND", () => {
        expect(orderNeedsApprovalNode.params.parse({})).toEqual({ thresholdVnd: 5_000_000 })
    })
})

describe("order.confirm", () => {
    it("confirms once per order across runs: the dedupe key is the order", async () => {
        const calls: Array<[string, unknown, unknown]> = []
        const context = {
            effect: (kind: string, payload: unknown, options: unknown) => {
                calls.push([kind, payload, options])
                return Promise.resolve({ kind, id: "x" })
            },
        } as unknown as NodeContext

        await orderConfirmNode.run({ orderId: "o1" }, context as never)

        expect(calls).toEqual([["order.confirm", { orderId: "o1" }, { dedupeKey: "order-confirm:o1" }]])
    })
})

describe("core.raise-work-item", () => {
    it("takes the action and the title from the params", () => {
        expect(raiseWorkItemNode.params.safeParse({ action: "Bad Action", title: "x" }).success).toBe(false)
        expect(raiseWorkItemNode.params.safeParse({ action: "confirm_order", title: "x" }).success).toBe(true)
    })
})

describe("payment.request", () => {
    const order = { id: "o1", orderNo: "DH-20261105-0001", amountVnd: 300_000, status: "confirmed", items: [] }
    const instruction = {
        bankName: null,
        bankCode: "MBBank",
        accountNumber: "525209999",
        accountHolder: null,
        qrUrl: "https://qr.example/x",
        provider: "sepay",
    }

    const run = async (answer: () => Promise<unknown>) => {
        const effectsRun: Array<[string, Record<string, unknown>, unknown]> = []
        const toolCalls: Array<[string, unknown]> = []
        const context = {
            data: { read: () => Promise.resolve([order]) },
            effect: (kind: string, payload: Record<string, unknown>, options: unknown) => {
                effectsRun.push([kind, payload, options])
                return Promise.resolve({ kind, id: "x" })
            },
            tools: {
                call: (name: string, args: unknown) => {
                    toolCalls.push([name, args])
                    return answer()
                },
            },
        }
        const output = await paymentRequestNode.run(
            { orderId: "o1", conversationId: "conv-1", locale: "en" },
            context as never,
        )
        return { output, effectsRun, toolCalls }
    }

    it("asks the tool with the order number, the amount and the transfer content, then sends once per order", async () => {
        const { output, effectsRun, toolCalls } = await run(() => Promise.resolve(instruction))

        expect(toolCalls).toEqual([
            ["payment.instruction", { orderNo: "DH-20261105-0001", amountVnd: 300_000, transferContent: "DH202611050001" }],
        ])
        expect(output).toEqual({ status: "sent", content: "DH202611050001", qrUrl: "https://qr.example/x" })
        expect(effectsRun).toHaveLength(1)
        expect(effectsRun[0]?.[0]).toBe("channel.send")
        expect(effectsRun[0]?.[1].text).toContain("Bank: MBBank")
        expect(effectsRun[0]?.[2]).toEqual({ dedupeKey: "payment-request:o1" })
    })

    it.each([
        ["the tool fails", () => Promise.reject(new Error("no provider connected"))],
        ["the tool answers something else", () => Promise.resolve({ error: "no provider" })],
    ])("raises a connect_sepay work item and sends nothing when %s", async (_name, answer) => {
        const { output, effectsRun } = await run(answer)

        expect(output).toEqual({ status: "no_account", content: null, qrUrl: null })
        expect(effectsRun.map(([kind]) => kind)).toEqual(["work-item.raise"])
        expect(effectsRun[0]?.[1]).toMatchObject({ action: "connect_sepay", payload: { orderId: "o1" } })
    })

    it("declares no provider data: it reads the order only", () => {
        expect(paymentRequestNode.rights.map((right) => right.kind)).toEqual(["order"])
    })
})
