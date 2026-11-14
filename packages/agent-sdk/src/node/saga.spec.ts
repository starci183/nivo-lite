import { z } from "zod"
import { defineEffect, defineTool } from "./effect"
import { defineNode } from "./node"
import type { NodeDefinition } from "./node.types"
import { nodeIndexOf } from "./problems"
import { nodeSagaOf } from "./saga"
import { trusted } from "../schema/trusted"

const voidOrder = defineEffect({
    id: "order.void",
    title: { key: "v" },
    payload: z.object({ id: z.string().max(200) }),
})
const record = defineEffect({ ...voidOrder, id: "order.record" })
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
    it("reads a node with no effect and only read tools", () => {
        expect(nodeSagaOf(nodeOf([], ["order.look"]), index)).toBe("read")
    })

    it("writes on an effect, an uninstalled one, a mutating tool or an uninstalled tool", () => {
        expect(nodeSagaOf(nodeOf(["order.record"], ["order.look"]), index)).toBe("write")
        expect(nodeSagaOf(nodeOf(["order.record", "channel.send"]), index)).toBe("write")
        expect(nodeSagaOf(nodeOf(["order.ghost"]), index)).toBe("write")
        expect(nodeSagaOf(nodeOf([], ["order.charge"]), index)).toBe("write")
        expect(nodeSagaOf(nodeOf([], ["order.gone"]), index)).toBe("write")
    })
})
