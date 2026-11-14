import { LOOP_MAX, LOOP_STEP, runNode } from "@nivo-lite/agent-sdk/node"
import { EXAMPLE_TURN, fakeNodePorts, nodeExampleMismatches } from "@nivo-lite/agent-sdk/testing"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { coreEffects } from "../../vocabulary/effects"
import { FOR_EACH_MAX, coreForEachNode } from "./for-each.node"

const loop = (items: ReadonlyArray<JsonValue>, params: Record<string, unknown> = {}) =>
    runNode(
        {
            node: coreForEachNode,
            params,
            input: { items },
            turn: EXAMPLE_TURN,
            grant: {},
            effects: new Map(coreEffects.map((effect) => [effect.id, effect])),
            tools: new Map(),
            key: "k",
        },
        fakeNodePorts().ports,
    )

const numbers = (count: number): ReadonlyArray<JsonValue> => Array.from({ length: count }, (_, index) => index)

describe("core.for-each", () => {
    it("is the loop step the engine drives, and touches nothing", () => {
        expect(coreForEachNode.id).toBe(LOOP_STEP)
        expect(coreForEachNode.effects).toEqual([])
        expect(FOR_EACH_MAX).toBe(LOOP_MAX)
    })

    it.each(coreForEachNode.examples.map((each) => [each.name, each] as const))("example: %s", async (_name, each) => {
        await expect(nodeExampleMismatches(coreForEachNode, each, coreEffects)).resolves.toEqual([])
    })

    it("answers an empty list with no item and nothing held", async () => {
        expect((await loop([])).output).toEqual({ items: [], held: null, results: [] })
    })

    it("answers an empty body: each element keyed by its index with a null output", async () => {
        expect((await loop(["a", "b", "c"])).output).toEqual({
            items: [
                { key: "0", output: null },
                { key: "1", output: null },
                { key: "2", output: null },
            ],
            held: null,
            results: [null, null, null],
        })
    })

    it("takes a list exactly as long as its max with nothing held", async () => {
        expect((await loop(numbers(3), { max: 3 })).output).toMatchObject({ held: null })
        expect((await loop(numbers(FOR_EACH_MAX))).output).toMatchObject({ held: null })
    })

    it("runs the first max items of a longer list and counts the rest in held, never failing", async () => {
        const output = coreForEachNode.output.parse((await loop(numbers(FOR_EACH_MAX + 2))).output)
        expect(output.items).toHaveLength(FOR_EACH_MAX)
        expect(output.held).toEqual({ count: 2, firstKey: String(FOR_EACH_MAX) })
        expect((await loop(numbers(4), { max: 3 })).output).toMatchObject({ held: { count: 1, firstKey: "3" } })
    })

    it("takes collect and itemKey as settings, and refuses a max below one or above the node's own limit", () => {
        expect(coreForEachNode.params.safeParse({ max: 0 }).success).toBe(false)
        expect(coreForEachNode.params.safeParse({ max: FOR_EACH_MAX + 1 }).success).toBe(false)
        expect(coreForEachNode.params.parse({})).toEqual({ max: FOR_EACH_MAX })
        expect(coreForEachNode.params.parse({ collect: "record", itemKey: "orderId" })).toEqual({
            max: FOR_EACH_MAX,
            collect: "record",
            itemKey: "orderId",
        })
    })
})
