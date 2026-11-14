import { z } from "zod"
import { defineEffect, defineTool } from "./effect"
import { defineNode } from "./node"
import type { NodeDefinition } from "./node.types"
import { nodeIndexOf, nodeListProblems } from "./problems"
import { nodeSagaOf } from "./saga"
import { trusted } from "../schema/trusted"

const voidOrder = defineEffect({
    id: "order.void",
    title: { key: "v" },
    payload: z.object({ id: z.string().max(200) }),
})
const record = defineEffect({ ...voidOrder, id: "order.record", compensation: "order.void" })
const send = defineEffect({ ...voidOrder, id: "channel.send" })
const look = defineTool({
    id: "order.look",
    title: { key: "l" },
    args: z.object({}),
    result: z.object({}),
    mutates: false,
})
const charge = defineTool({ ...look, id: "order.charge", mutates: true })

const nodeOf = (
    effects: ReadonlyArray<"order.record" | "channel.send" | "order.ghost">,
    tools: ReadonlyArray<"order.look" | "order.charge" | "order.gone"> = [],
): NodeDefinition =>
    trusted<NodeDefinition>(
        defineNode({
            id: "order.step",
            role: "output",
            title: { key: "s" },
            params: z.object({}),
            input: z.object({}),
            output: z.object({}),
            effects,
            tools,
            run: () => Promise.resolve({}),
            examples: [{ name: "e", params: {}, input: {}, output: {}, effects: [] }],
        }),
    )

const index = nodeIndexOf({ nodes: [], effects: [voidOrder, record, send], tools: [look, charge], dataKinds: [] })

describe("nodeSagaOf", () => {
    it("reads a node with no effect and only read tools, and undoes one whose every effect names its undo", () => {
        expect(nodeSagaOf(nodeOf([], ["order.look"]), index)).toBe("read")
        expect(nodeSagaOf(nodeOf(["order.record"], ["order.look"]), index)).toBe("compensable")
    })

    it("pivots on an effect with no undo, an uninstalled one, a mutating tool or an uninstalled tool", () => {
        expect(nodeSagaOf(nodeOf(["order.record", "channel.send"]), index)).toBe("pivot")
        expect(nodeSagaOf(nodeOf(["order.ghost"]), index)).toBe("pivot")
        expect(nodeSagaOf(nodeOf([], ["order.charge"]), index)).toBe("pivot")
        expect(nodeSagaOf(nodeOf([], ["order.gone"]), index)).toBe("pivot")
    })
})

describe("effect compensation", () => {
    it("refuses a malformed compensation id, and names one nobody installed", () => {
        expect(() => defineEffect({ ...voidOrder, compensation: trusted<"a.b">("Bad") })).toThrow("ID_MALFORMED")
        expect(nodeListProblems({ nodes: [], effects: [record], tools: [], dataKinds: [] })).toEqual([
            { code: "EFFECT_COMPENSATION_UNKNOWN", at: "order.record:order.void" },
        ])
    })
})
