import { runNode } from "@nivo-lite/agent-sdk/node"
import { EXAMPLE_TURN, fakeNodePorts, nodeExampleMismatches } from "@nivo-lite/agent-sdk/testing"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { coreEffects } from "../../vocabulary/effects"
import { IF_OPS, coreIfNode, ifHolds } from "./if.node"
import type { IfOp } from "./if.node"

const branchOf = async (value: JsonValue, op: IfOp, compare?: JsonValue): Promise<unknown> => {
    const fake = fakeNodePorts()
    const run = await runNode(
        {
            node: coreIfNode,
            params: compare === undefined ? { op } : { op, compare },
            input: { value },
            turn: EXAMPLE_TURN,
            grant: {},
            effects: new Map(coreEffects.map((effect) => [effect.id, effect])),
            tools: new Map(),
            key: "k",
        },
        fake.ports,
    )
    return run.output
}

const CASES: ReadonlyArray<readonly [IfOp, JsonValue, JsonValue, boolean]> = [
    ["equals", "a", "a", true],
    ["equals", "a", "b", false],
    ["equals", { x: [1, 2] }, { x: [1, 2] }, true],
    ["equals", 1, "1", false],
    ["equals", null, null, true],
    ["not-equals", "a", "b", true],
    ["not-equals", "a", "a", false],
    ["in", "recommend", ["discover", "recommend"], true],
    ["in", "close", ["discover", "recommend"], false],
    ["in", { id: 1 }, [{ id: 1 }], true],
    ["in", "a", "a", false],
    ["in", "a", null, false],
    ["present", "x", null, true],
    ["present", 0, null, true],
    ["present", false, null, true],
    ["present", "", null, false],
    ["present", null, null, false],
    ["present", [], null, false],
    ["present", [0], null, true],
    ["absent", null, null, true],
    ["absent", "", null, true],
    ["absent", [], null, true],
    ["absent", "x", null, false],
    ["absent", 0, null, false],
    ["greater", 5, 3, true],
    ["greater", 3, 3, false],
    ["greater", 2, 3, false],
    ["greater", "5", 3, false],
    ["greater", 5, "3", false],
    ["less", 2, 3, true],
    ["less", 3, 3, false],
    ["less", 4, 3, false],
    ["less", null, 3, false],
]

describe("core.if", () => {
    it("is a condition that runs no effect", () => {
        expect(coreIfNode.role).toBe("condition")
        expect(coreIfNode.effects).toEqual([])
    })

    it.each(coreIfNode.examples.map((each) => [each.name, each] as const))("example: %s", async (_name, each) => {
        await expect(nodeExampleMismatches(coreIfNode, each, coreEffects)).resolves.toEqual([])
    })

    it("lists every comparison the editor offers, and the cases below cover each of them", () => {
        expect([...IF_OPS]).toEqual(["equals", "not-equals", "in", "present", "absent", "greater", "less"])
        expect(new Set(CASES.map(([op]) => op))).toEqual(new Set(IF_OPS))
    })

    it.each(CASES)("ifHolds: %s %j against %j is %s", (op, value, compare, expected) => {
        expect(ifHolds(value, op, compare)).toBe(expected)
    })

    it("goes the yes way or the no way for every comparison, as the node runs", async () => {
        await expect(branchOf("a", "equals", "a")).resolves.toEqual({ branch: "yes" })
        await expect(branchOf("a", "not-equals", "a")).resolves.toEqual({ branch: "no" })
        await expect(branchOf("close", "in", ["discover", "close"])).resolves.toEqual({ branch: "yes" })
        await expect(branchOf("done", "in", ["discover", "close"])).resolves.toEqual({ branch: "no" })
        await expect(branchOf("x", "present")).resolves.toEqual({ branch: "yes" })
        await expect(branchOf(null, "present")).resolves.toEqual({ branch: "no" })
        await expect(branchOf(null, "absent")).resolves.toEqual({ branch: "yes" })
        await expect(branchOf("x", "absent")).resolves.toEqual({ branch: "no" })
        await expect(branchOf(9, "greater", 5)).resolves.toEqual({ branch: "yes" })
        await expect(branchOf(1, "greater", 5)).resolves.toEqual({ branch: "no" })
        await expect(branchOf(1, "less", 5)).resolves.toEqual({ branch: "yes" })
        await expect(branchOf(9, "less", 5)).resolves.toEqual({ branch: "no" })
    })

    it("compares with null when the graph writes no compare value", () => {
        expect(coreIfNode.params.parse({ op: "present" })).toEqual({ op: "present", compare: null })
    })

    it("refuses an unknown comparison", () => {
        expect(coreIfNode.params.safeParse({ op: "like" }).success).toBe(false)
    })
})
