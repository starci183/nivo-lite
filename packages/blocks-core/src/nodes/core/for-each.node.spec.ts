import { LOOP_STEP, NodeBusinessFailure, runNode } from "@nivo-lite/agent-sdk/node"
import { EXAMPLE_TURN, fakeNodePorts, nodeExampleMismatches } from "@nivo-lite/agent-sdk/testing"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { coreEffects } from "../../vocabulary/effects"
import { FOR_EACH_MAX, LIST_TOO_LONG, coreForEachNode } from "./for-each.node"

const loop = (items: ReadonlyArray<JsonValue>, params: Record<string, unknown> = {}) =>
    runNode(
        {
            node: coreForEachNode,
            params,
            input: { items },
            turn: EXAMPLE_TURN,
            grant: { rights: [] },
            effects: new Map(coreEffects.map((effect) => [effect.id, effect])),
            tools: new Map(),
            key: "k",
        },
        fakeNodePorts().ports,
    )

/** The business failure a loop ends in; any other outcome fails the test. */
const failureOf = async (items: ReadonlyArray<JsonValue>, params: Record<string, unknown> = {}) => {
    const cause = await loop(items, params).then(
        () => null,
        (error: unknown) => error,
    )
    expect(cause).toBeInstanceOf(NodeBusinessFailure)
    return cause instanceof NodeBusinessFailure ? cause.failure : null
}

const numbers = (count: number): ReadonlyArray<JsonValue> => Array.from({ length: count }, (_, index) => index)

describe("core.for-each", () => {
    it("is the loop step the engine drives, and touches nothing", () => {
        expect(coreForEachNode.id).toBe(LOOP_STEP)
        expect(coreForEachNode.effects).toEqual([])
        expect(coreForEachNode.rights).toEqual([])
    })

    it.each(coreForEachNode.examples.map((each) => [each.name, each] as const))("example: %s", async (_name, each) => {
        await expect(nodeExampleMismatches(coreForEachNode, each, coreEffects)).resolves.toEqual([])
    })

    it("answers an empty list with nothing done and nothing failed", async () => {
        expect((await loop([])).output).toEqual({ results: [], okCount: 0, failed: [] })
    })

    it("answers an empty body: a null result for each element, all of them ok", async () => {
        expect((await loop(["a", "b", "c"])).output).toEqual({ results: [null, null, null], okCount: 3, failed: [] })
    })

    it("takes a list exactly as long as its max", async () => {
        expect((await loop(numbers(3), { max: 3 })).output).toMatchObject({ okCount: 3 })
        expect((await loop(numbers(FOR_EACH_MAX))).output).toMatchObject({ okCount: FOR_EACH_MAX })
    })

    it("fails the step in a business failure, list_too_long, when the list is longer than max", async () => {
        expect(await failureOf(numbers(4), { max: 3 })).toMatchObject({
            code: LIST_TOO_LONG,
            messageKey: "nodeFailureCoreForEachListTooLong",
            fields: { count: 4, max: 3 },
        })
        expect(LIST_TOO_LONG).toBe("list_too_long")
    })

    it("uses the default max of the node when the graph sets none", async () => {
        expect((await failureOf(numbers(FOR_EACH_MAX + 1)))?.fields).toEqual({ count: FOR_EACH_MAX + 1, max: FOR_EACH_MAX })
    })

    it("refuses a max below one or above the node's own limit", () => {
        expect(coreForEachNode.params.safeParse({ max: 0 }).success).toBe(false)
        expect(coreForEachNode.params.safeParse({ max: FOR_EACH_MAX + 1 }).success).toBe(false)
        expect(coreForEachNode.params.parse({})).toEqual({ max: FOR_EACH_MAX })
    })
})
