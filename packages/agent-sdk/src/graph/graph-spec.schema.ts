import { z } from "zod"
import type { NodeInputBinding } from "../node"
import { burstIsSound } from "./graph-burst"
import type { GraphSpec } from "./graph-spec.types"

const KEY = /^[a-z][a-z0-9-]*$/

const right = z.strictObject({
    kind: z.string().min(1),
    access: z.enum(["read", "write"]),
    scope: z.enum(["turn", "workspace"]),
    fields: z.tuple([z.string().min(1)], z.string().min(1)),
})

/** A binding: a literal, a reference, or a list or object of either, at any depth. */
const binding: z.ZodType<NodeInputBinding> = z.lazy(() =>
    z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.null(),
        z.strictObject({ $ref: z.string().min(1) }),
        z.array(binding),
        z.record(z.string(), binding),
    ]),
)

const node = z.strictObject({
    key: z.string().regex(KEY),
    kind: z.enum(["trigger", "condition", "execute", "output"]),
    step: z.string().min(1),
    params: z.record(z.string(), z.json()).optional(),
    input: z.record(z.string(), binding).optional(),
    next: z.string().regex(KEY).optional(),
    routes: z.record(z.string(), z.string().regex(KEY)).optional(),
})

const SOURCES = ["channel", "chats-group", "agent", "system-event", "schedule"] as const

/** A burst entry: a window and a longest wait that are durations in range, the wait no shorter than the window. */
/** A duration as a graph spec writes it: a whole number of milliseconds, seconds or minutes. */
const duration = z.string().regex(/^[0-9]{1,6}(ms|s|m)$/)

const burst = z
    .strictObject({ window: duration, maxWait: duration.optional() })
    .refine((entry) => burstIsSound(entry), {
        message: "burst must be sound durations: window up to 1m, maxWait up to 2m and not below the window",
    })

/** The structure of an agent graph spec; the nodes are judged against the installed ones by `graphSpecProblems`. */
export const graphSpecSchema: z.ZodType<GraphSpec> = z.strictObject({
    schema: z.literal("nivo/agent-graph@1"),
    moduleKey: z.string().regex(/^[a-z][a-z0-9_]{1,23}$/),
    trigger: z.strictObject({
        kind: z.literal("tag"),
        sources: z.array(z.enum(SOURCES)).min(1),
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
        rights: z.array(right),
        tools: z.array(z.string()),
        effects: z.array(z.string()),
    }),
    nodes: z.array(node).min(1),
})

/**
 * The JSON Schema of a graph spec, generated from `graphSpecSchema`: what a seed step that validates spec files by JSON Schema reads, so
 * the file and the zod schema can never say different things.
 */
export const graphSpecJsonSchema = (): Readonly<Record<string, unknown>> => ({
    ...z.toJSONSchema(graphSpecSchema, { target: "draft-2020-12" }),
    title: "NIVO agent graph spec",
})
