import { z } from "../schema/zod-entry"
import { EXAMPLE_TURN } from "../tests/fixtures/node-examples"
import { scriptedNodePorts } from "../tests/fixtures/node-ports"
import { runNode } from "./host"
import { isBusinessFailure, isNodeConfused, NodeConfused } from "./memory"
import { defineNode } from "./node"

const ANSWER = z.object({ orderId: z.string() })

/** A node whose AI picks an order, or says it cannot: the shape every AI node of a graph takes. */
const pickNode = defineNode({
    id: "core.pick",
    role: "execute",
    title: { key: "t" },
    params: z.object({}),
    input: z.object({ text: z.string() }),
    output: z.object({ orderId: z.string() }),
    rights: [],
    effects: [],
    run: async (input, context) => {
        const decision = await context.model.decide(ANSWER, {
            purpose: "pick",
            instructions: "Pick the order the text names.",
            input,
        })
        if (decision.kind === "confused") return context.confused(decision.confusion)
        return decision.value
    },
    examples: [
        {
            name: "picks the order",
            params: {},
            input: { text: "DH-1" },
            output: { orderId: "o-1" },
            effects: [],
            model: [{ answer: { orderId: "o-1" } }],
        },
    ],
})

const run = (model: ReadonlyArray<unknown>) => {
    const fake = scriptedNodePorts({ model })
    const json = jest.spyOn(fake.ports.model, "json")
    const ran = runNode(
        {
            node: pickNode,
            params: {},
            input: { text: "DH-1" },
            turn: EXAMPLE_TURN,
            grant: { rights: [] },
            effects: new Map(),
            tools: new Map(),
            key: "k",
        },
        fake.ports,
    )
    return { ran, json }
}

describe("context.model.decide", () => {
    it("answers the node's own schema when the AI can decide", async () => {
        const { ran } = run([{ answer: { orderId: "o-1" } }])
        await expect(ran).resolves.toEqual({ output: { orderId: "o-1" }, effects: [] })
    })

    it("asks the host once, under the node's purpose, with the way out of guessing added to the node's instructions", async () => {
        const { ran, json } = run([{ answer: { orderId: "o-1" } }])
        await ran
        expect(json).toHaveBeenCalledTimes(1)
        const asked = json.mock.calls[0]?.[1]
        expect(asked?.purpose).toBe("core.pick:pick")
        expect(asked?.instructions.startsWith("Pick the order the text names.")).toBe(true)
        expect(asked?.instructions).toContain('"confused"')
    })

    it("answers the confusion, in the AI's own words, when the AI says it cannot decide", async () => {
        const confusion = { reason: "Hai đơn cùng mã", question: "Đơn nào là của khách?" }
        const { ran } = run([{ confused: confusion }])

        const cause = await ran.then(
            () => null,
            (thrown: unknown) => thrown,
        )

        expect(isNodeConfused(cause)).toBe(true)
        expect(cause instanceof NodeConfused ? cause.confusion : null).toEqual(confusion)
        expect(isBusinessFailure(cause)).toBe(false)
    })

    it("refuses an answer that fits neither shape, like any structured answer", async () => {
        const { ran } = run([{ orderId: "o-1" }])
        await expect(ran).rejects.toThrow()
    })
})
