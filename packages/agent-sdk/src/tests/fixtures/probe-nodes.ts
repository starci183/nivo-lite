import { z } from "zod"
import { defineEffect, defineNode, defineTool } from "../../node"
import type { EffectDefinition, ToolDefinition } from "../../node/effect.types"
import type { NodeDefinition } from "../../node/node.types"
import type { DataRight } from "../../rights/rights.types"

/** The right to read the `record` kind of the turn. */
export const PROBE_READ: DataRight = { kind: "record", access: "read", scope: "turn", fields: ["id"] }

/** The right to write the `record` kind of the turn. */
export const PROBE_WRITE: DataRight = { kind: "record", access: "write", scope: "turn", fields: ["id"] }

/** An effect with a compensation, `core.unping`. */
export const pingEffect: EffectDefinition = defineEffect({
    id: "core.ping",
    title: { key: "p" },
    payload: z.object({ n: z.number() }),
    rights: [],
    compensation: "core.unping",
})

/** The compensation of `core.ping`. */
export const unpingEffect: EffectDefinition = defineEffect({
    id: "core.unping",
    title: { key: "u" },
    payload: z.object({ id: z.string().max(100) }),
    rights: [],
})

/** An effect whose compensation is not installed. */
export const lostEffect: EffectDefinition = defineEffect({ ...pingEffect, id: "core.lost", compensation: "core.gone" })

/** An effect whose compensation parses its payload to a bare text, which is no record. */
export const flatEffect: EffectDefinition = defineEffect({
    ...pingEffect,
    id: "core.flat",
    compensation: "core.unflat",
})

/** The compensation of `core.flat`: its payload parses to a text. */
export const unflatEffect: EffectDefinition = defineEffect({
    id: "core.unflat",
    title: { key: "uf" },
    payload: z.object({ id: z.string().max(100) }).transform(({ id }) => id),
    rights: [],
})

/** A read-only tool that answers `{ seen: true }`. */
export const lookTool: ToolDefinition = defineTool({
    id: "core.look",
    title: { key: "l" },
    args: z.object({}),
    result: z.object({ seen: z.boolean() }),
    mutates: false,
    rights: [],
})

/** A node that touches every port once (data, effect or write, model text and json, tool, clock) and answers what came back. */
export const probeNode: NodeDefinition = defineNode({
    id: "core.probe",
    role: "execute",
    title: { key: "t" },
    params: z.object({}),
    input: z.object({ write: z.boolean() }),
    output: z.object({
        rows: z.number(),
        ref: z.string().max(100),
        text: z.string().max(500),
        n: z.number(),
        seen: z.boolean(),
        at: z.number(),
    }),
    rights: [PROBE_READ, PROBE_WRITE],
    effects: ["core.ping"],
    tools: ["core.look"],
    run: async (input, context) => {
        const rows = await context.data.read("record", { fields: ["id"] })
        const ref = input.write
            ? await context.data.write("record", { id: "r" })
            : await context.effect("core.ping", { n: 1 })
        const text = await context.model.text({ purpose: "say", instructions: "", input: null })
        const json = await context.model.json(z.object({ n: z.number() }), {
            purpose: "count",
            instructions: "",
            input: null,
        })
        const tool = await context.tools.call<{ seen: boolean }>("core.look", {})
        return {
            rows: rows.length,
            ref: ref.id,
            text,
            n: json.n,
            seen: tool.seen,
            at: Math.sign(context.now().getTime()),
        }
    },
    examples: [
        {
            name: "runs the effect",
            params: {},
            input: { write: false },
            output: { rows: 0, ref: "core.ping-1", text: "hi", n: 2, seen: true, at: 0 },
            effects: ["core.ping"],
            model: ["hi", { n: 2 }],
            tools: [{ seen: true }],
        },
        {
            name: "writes the record",
            params: {},
            input: { write: true },
            output: { rows: 0, ref: "record-1", text: "hi", n: 2, seen: true, at: 0 },
            effects: [],
            model: ["hi", { n: 2 }],
            tools: [{ seen: true }],
        },
    ],
})

/**
 * A node that catches every failure of its tool and answers a fallback, the way a node files a connect item or takes a skip branch:
 * `after` names the port it touches next, an effect, a write, or none.
 */
export const swallowNode: NodeDefinition = defineNode({
    id: "core.swallow",
    role: "execute",
    title: { key: "s" },
    params: z.object({}),
    input: z.object({ after: z.enum(["effect", "write", "none"]).optional() }),
    output: z.object({ fell: z.boolean() }),
    rights: [PROBE_WRITE],
    effects: ["core.ping"],
    tools: ["core.look"],
    run: async (input, context) => {
        try {
            await context.tools.call("core.look", {})
            return { fell: false }
        } catch (cause) {
            if (input.after === "write") await context.data.write("record", { id: "r" })
            else if (input.after !== "none") await context.effect("core.ping", { n: 1 })
            return { fell: cause !== undefined }
        }
    },
    examples: [
        {
            name: "calls the tool",
            params: {},
            input: {},
            output: { fell: false },
            effects: [],
            tools: [{ seen: true }],
        },
        {
            name: "falls back to nothing when the tool fails",
            params: {},
            input: { after: "none" },
            output: { fell: true },
            effects: [],
        },
        {
            name: "falls back to an effect when the tool fails",
            params: {},
            input: {},
            output: { fell: true },
            effects: ["core.ping"],
        },
        {
            name: "falls back to a write when the tool fails",
            params: {},
            input: { after: "write" },
            output: { fell: true },
            effects: [],
        },
    ],
})
