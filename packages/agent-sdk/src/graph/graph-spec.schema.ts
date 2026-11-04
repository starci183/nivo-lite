import { z } from "zod"
import type { NodeInputBinding } from "../node"
import { keyText, prose } from "../schema/bounded.schema"
import type { JsonSchema } from "../schema/schema.types"
import { entriesAtMost } from "../schema/entries"
import { jsonValue } from "../schema/json-value.schema"
import { burstIsSound } from "./graph-burst"
import type { GraphSpec } from "./graph-spec.types"

const key = keyText.regex(/^[a-z][a-z0-9-]*$/)

const right = z.strictObject({
    kind: keyText.min(1),
    access: z.enum(["read", "write"]),
    scope: z.enum(["turn", "workspace"]),
    fields: z.tuple([keyText.min(1)], keyText.min(1)),
})

/** A binding: a literal, a reference, or a list or object of either, at any depth. */
const binding: z.ZodType<NodeInputBinding> = z.lazy(() =>
    z.union([
        prose,
        z.number(),
        z.boolean(),
        z.null(),
        z.strictObject({ $ref: keyText.min(1) }),
        z.array(binding).max(200),
        z.record(keyText, binding).refine(entriesAtMost(200)),
    ]),
)

const node = z.strictObject({
    key,
    kind: z.enum(["trigger", "condition", "execute", "output"]),
    step: keyText.min(1),
    params: z.record(keyText, jsonValue).refine(entriesAtMost(200)).optional(),
    input: z.record(keyText, binding).refine(entriesAtMost(200)).optional(),
    next: key.optional(),
    routes: z.record(keyText, key).refine(entriesAtMost(50)).optional(),
})

const source = z.enum(["channel", "chats-group", "agent", "system-event", "schedule"])

/** A duration as a graph spec writes it: a whole number of milliseconds, seconds or minutes. */
const duration = keyText.regex(/^\d{1,6}(ms|s|m)$/)

/** A burst entry: a window and a longest wait that are durations in range, the wait no shorter than the window. */
const burst = z
    .strictObject({ window: duration, maxWait: duration.optional() })
    .refine((entry) => burstIsSound(entry), {
        message: "burst must be sound durations: window up to 1m, maxWait up to 2m and not below the window",
    })

/** The structure of an agent graph spec; the nodes are judged against the installed ones by `graphSpecProblems`. */
export const graphSpecSchema: z.ZodType<GraphSpec> = z.strictObject({
    schema: z.literal("nivo/agent-graph@1"),
    moduleKey: keyText.regex(/^[a-z][a-z0-9_]{1,23}$/),
    trigger: z.strictObject({
        kind: z.literal("tag"),
        sources: z.array(source).min(1).max(5),
        burst: z
            .strictObject({
                channel: burst.optional(),
                "chats-group": burst.optional(),
                agent: burst.optional(),
                "system-event": burst.optional(),
                schedule: burst.optional(),
            })
            .optional(),
    }),
    grant: z.strictObject({
        rights: z.array(right).max(100),
        tools: z.array(keyText).max(100),
        effects: z.array(keyText).max(100),
    }),
    nodes: z.array(node).min(1).max(200),
})

/**
 * The JSON Schema of a graph spec, generated from `graphSpecSchema`: what a seed step that validates spec files by JSON Schema reads, so
 * the file and the zod schema can never say different things.
 */
export const graphSpecJsonDocument: JsonSchema = z.toJSONSchema(
    graphSpecSchema.meta({ title: "NIVO agent graph spec" }),
    {
        target: "draft-2020-12",
    },
)
