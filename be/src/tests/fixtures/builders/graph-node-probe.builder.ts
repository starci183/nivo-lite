import {
    defineDataKind,
    defineEffect,
    defineNode,
    defineTool,
    type DataKindDefinition,
    type EffectDefinition,
    type NodeDefinition,
    type ToolDefinition,
} from "@nivo-lite/agent-sdk/node"
import { isRecord } from "@modules/platform/primitives"
import {
    PROBE_COUNT,
    PROBE_LOOK_RESULT,
    PROBE_NOTHING,
    PROBE_PING_PAYLOAD,
    PROBE_INPUT,
    PROBE_OUTPUT,
    PROBE_RECORD_FIELDS,
    PROBE_SWALLOW_OUTPUT,
    PROBE_UNPING_PAYLOAD,
    type ProbeSchema,
} from "@modules/domain/graph-nodes"

/** The right to read the `record` kind of the turn. */
export const READ = { kind: "record", access: "read", scope: "turn", fields: ["id"] } as const

/** The right to write the `record` kind of the turn. */
export const WRITE = { kind: "record", access: "write", scope: "turn", fields: ["id"] } as const

/** The compensation of `core.ping`. */
export const unping: EffectDefinition = defineEffect({
    id: "core.unping",
    title: { key: "u" },
    payload: PROBE_UNPING_PAYLOAD,
    rights: [],
})

/** An effect with a compensation. */
export const ping: EffectDefinition = defineEffect({
    id: "core.ping",
    title: { key: "p" },
    payload: PROBE_PING_PAYLOAD,
    rights: [],
    compensation: "core.unping",
})

/** An effect whose compensation is not installed. */
export const lost: EffectDefinition = defineEffect({ ...ping, id: "core.lost", compensation: "core.gone" })

/** An effect with an empty payload and no compensation. */
export const emptyPing: EffectDefinition = defineEffect({
    id: "core.ping",
    title: { key: "p" },
    payload: PROBE_NOTHING,
    rights: [],
})

/** A read-only tool. */
export const look: ToolDefinition = defineTool({
    id: "core.look",
    title: { key: "l" },
    args: PROBE_NOTHING,
    result: PROBE_LOOK_RESULT,
    mutates: false,
    rights: [],
})

/** The `record` data kind. */
export const record: DataKindDefinition = defineDataKind({
    kind: "record",
    title: { key: "r" },
    fields: PROBE_RECORD_FIELDS,
})

/** A node that touches every port once and answers what came back. */
export const probe: NodeDefinition = defineNode<ProbeSchema, ProbeSchema, ProbeSchema>({
    id: "core.probe",
    role: "execute",
    title: { key: "t" },
    params: PROBE_NOTHING,
    input: PROBE_INPUT,
    output: PROBE_OUTPUT,
    rights: [READ, WRITE],
    effects: ["core.ping"],
    tools: ["core.look"],
    run: async (input, context) => {
        const rows = await context.data.read("record", { fields: ["id"] })
        const ref =
            isRecord(input) && input.write === true
                ? await context.data.write("record", { id: "r" })
                : await context.effect("core.ping", { n: 1 })
        const text = await context.model.text({ purpose: "say", instructions: "", input: null })
        const json = await context.model.json(PROBE_COUNT, { purpose: "count", instructions: "", input: null })
        const tool = await context.tools.call<{ seen: boolean }>("core.look", {})
        return {
            rows: rows.length,
            ref: ref.id,
            text,
            n: json.n,
            seen: tool.seen,
            at: context.now().getTime() > 0 ? 1 : 0,
        }
    },
    examples: [
        {
            name: "e",
            params: {},
            input: { write: false },
            output: { rows: 0, ref: "", text: "", n: 0, seen: true, at: 1 },
            effects: [],
        },
    ],
})

/** A node that catches every failure of its tool and answers a fallback, the way a node files a connect item or takes a skip branch. */
export const swallow: NodeDefinition = defineNode<ProbeSchema, ProbeSchema, ProbeSchema>({
    id: "core.swallow",
    role: "execute",
    title: { key: "s" },
    params: PROBE_NOTHING,
    input: PROBE_NOTHING,
    output: PROBE_SWALLOW_OUTPUT,
    rights: [],
    effects: ["core.ping"],
    tools: ["core.look"],
    run: async (_input, context) => {
        const fell = await context.tools.call("core.look", {}).then(
            () => false,
            () => true,
        )
        if (fell) await context.effect("core.ping", { n: 1 })
        return { fell }
    },
    examples: [{ name: "s", params: {}, input: {}, output: { fell: false }, effects: [], tools: [{ seen: true }] }],
})

/** A node that names an effect nobody installed. */
export const echo: NodeDefinition = defineNode<ProbeSchema, ProbeSchema, ProbeSchema>({
    id: "core.echo",
    role: "execute",
    title: { key: "e" },
    params: PROBE_NOTHING,
    input: PROBE_NOTHING,
    output: PROBE_NOTHING,
    rights: [],
    effects: ["core.ping", "core.ghost"],
    run: () => Promise.resolve({}),
    examples: [{ name: "e", params: {}, input: {}, output: {}, effects: [] }],
})
