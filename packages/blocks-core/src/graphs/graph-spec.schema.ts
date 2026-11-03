import { z } from "zod"
import type { GraphSpec } from "./graph-spec.types"

const KEY = /^[a-z][a-z0-9-]*$/

const right = z.strictObject({
    kind: z.string().min(1),
    access: z.enum(["read", "write"]),
    scope: z.enum(["turn", "workspace"]),
    fields: z.tuple([z.string().min(1)], z.string().min(1)),
})

const node = z.strictObject({
    key: z.string().regex(KEY),
    kind: z.enum(["trigger", "condition", "execute", "output"]),
    step: z.string().min(1),
    params: z.record(z.string(), z.unknown()).optional(),
    input: z.record(z.string(), z.json()).optional(),
    next: z.string().regex(KEY).optional(),
    routes: z.record(z.string(), z.string().regex(KEY)).optional(),
})

/** The structure of an agent graph spec file; the nodes are judged against the installed ones by `graphSpecProblems`. */
export const graphSpecSchema: z.ZodType<GraphSpec> = z.strictObject({
    schema: z.literal("nivo/agent-graph@1"),
    moduleKey: z.string().regex(/^[a-z][a-z0-9_]{1,23}$/),
    trigger: z.strictObject({
        kind: z.literal("tag"),
        sources: z.array(z.enum(["channel", "chats-group", "agent", "system-event", "schedule"])).min(1),
    }),
    grant: z.strictObject({
        rights: z.array(right),
        tools: z.array(z.string()),
        effects: z.array(z.string()),
    }),
    nodes: z.array(node).min(1),
})
