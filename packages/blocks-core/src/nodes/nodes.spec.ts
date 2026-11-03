import { RightsDeniedError } from "@nivo-lite/agent-sdk/node"
import type { NodeContext, NodeDefinition, SubjectRef } from "@nivo-lite/agent-sdk/node"
import { rightsGaps } from "@nivo-lite/agent-sdk/rights"
import { coreNodes, orderCompleteNode, orderConfirmNode, paymentRequestNode } from "./index"

// A stand-in for the SDK's runNodeExamples until the host lead's SDK lands: the same contract, one context per example.

interface RecordedEffect {
    readonly kind: string
    readonly payload: unknown
}

type Row = Readonly<Record<string, unknown>>

const matches = (row: Row, where: Readonly<Record<string, string | number | boolean>>): boolean =>
    Object.entries(where).every(([name, value]) => row[name] === value)

const pick = (row: Row, fields: ReadonlyArray<string>): Row =>
    Object.fromEntries(fields.map((field) => [field, row[field]]))

const contextOf = (
    node: NodeDefinition,
    params: unknown,
    store: Readonly<Record<string, ReadonlyArray<Row>>>,
    effects: Array<RecordedEffect>,
): NodeContext => ({
    turn: { turnId: "turn-1", workspaceId: "workspace-1", agentId: "agent-1", subject: null },
    params: node.params.parse(params),
    data: {
        read: <T>(kind: string, query: Parameters<NodeContext["data"]["read"]>[1]): Promise<ReadonlyArray<T>> => {
            const [first, ...rest] = query.fields
            if (first === undefined) throw new RightsDeniedError(kind)
            const wanted = { kind, access: "read", scope: "turn", fields: [first, ...rest] } as const
            if (rightsGaps({ rights: node.rights }, [wanted]).length > 0) throw new RightsDeniedError(kind)
            const rows = (store[kind] ?? []).filter((row) => matches(row, query.where ?? {}))
            return Promise.resolve(rows.slice(0, query.limit).map((row) => pick(row, query.fields)) as ReadonlyArray<T>)
        },
        write: () => Promise.reject(new RightsDeniedError("write")),
    },
    effect: (kind: string, subject: SubjectRef, payload: unknown): Promise<SubjectRef> => {
        if (!node.effects.includes(kind as never)) throw new Error(`undeclared effect ${kind}`)
        effects.push({ kind, payload })
        return Promise.resolve({ kind: subject.kind, id: `${subject.kind}-${String(effects.length)}` })
    },
    model: { text: () => Promise.reject(new Error("no model call in a worked example")) },
    now: () => new Date(0),
})

const runOne = async (
    node: NodeDefinition,
    example: NodeDefinition["examples"][number],
): Promise<{ output: unknown; effects: ReadonlyArray<RecordedEffect> }> => {
    const effects: Array<RecordedEffect> = []
    const context = contextOf(node, example.params, example.store ?? {}, effects)
    const output = node.output.parse(await node.run(node.input.parse(example.input), context))
    return { output, effects }
}

describe("coreNodes", () => {
    it("lists the five nodes by id, in the order the graph runs them", () => {
        expect(coreNodes.map((node) => node.id)).toEqual([
            "order.record",
            "order.complete",
            "order.ask-missing",
            "order.confirm",
            "payment.request",
        ])
    })

    it("names every node by capability and routes on the two conditions", () => {
        expect(coreNodes.every((node) => /^(order|payment)\.[a-z-]+$/.test(node.id))).toBe(true)
        expect(coreNodes.filter((node) => node.role === "condition").map((node) => node.id)).toEqual([
            "order.complete",
            "order.confirm",
        ])
    })

    it.each(coreNodes.map((node) => [node.id, node] as const))(
        "%s: every example runs under its declared rights to its output and effects",
        async (_id, node) => {
            for (const example of node.examples) {
                const run = await runOne(node, example)

                expect(run.output).toEqual(example.output)
                expect(run.effects.map((effect) => effect.kind)).toEqual(
                    example.effects.map((effect) => (typeof effect === "string" ? effect : effect.kind)),
                )
                example.effects.forEach((effect, at) => {
                    if (typeof effect !== "string" && effect.payload !== undefined)
                        expect(run.effects[at]?.payload).toEqual(effect.payload)
                })
            }
        },
    )
})

describe("order.confirm", () => {
    it("defaults the threshold to 5,000,000 VND", () => {
        expect(orderConfirmNode.params.parse({})).toEqual({ thresholdVnd: 5_000_000 })
    })
})

describe("the host contract the examples run under", () => {
    it("refuses a read the node did not declare", async () => {
        const [example] = orderCompleteNode.examples

        await expect(runOne({ ...orderCompleteNode, rights: [] } as NodeDefinition, example)).rejects.toThrow(
            RightsDeniedError,
        )
    })

    it("refuses an effect the node did not declare", async () => {
        const stray = { ...paymentRequestNode, effects: [] } as NodeDefinition
        const [example] = paymentRequestNode.examples

        await expect(runOne(stray, example)).rejects.toThrow("undeclared effect")
    })

    it("refuses a write, a model call and a read without fields", async () => {
        const context = contextOf(paymentRequestNode as NodeDefinition, {}, {}, [])

        await expect(context.data.write("order", { id: "o1" })).rejects.toThrow(RightsDeniedError)
        await expect(context.model.text({ purpose: "x", instructions: "x", input: null })).rejects.toThrow(
            "no model call",
        )
        expect(() => context.data.read("order", { fields: [] })).toThrow(RightsDeniedError)
        expect(context.now().getTime()).toBe(0)
    })
})
