import { z } from "zod"
import type { NodeInputBinding } from "../node"
import { keyText, prose } from "../schema/bounded.schema"
import type { JsonSchema } from "../schema/schema.types"
import { entriesAtMost } from "../schema/entries"
import { jsonValue } from "../schema/json-value.schema"
import { withoutMember } from "../schema/without-member"
import {
    workflowContractSchema,
    workflowEntrySchema,
    workflowOutcomesSchema,
    workflowTriggersSchema,
} from "./workflow-contract"
import type { GraphSpec } from "./graph-spec.types"

const key = keyText.regex(/^[a-z][a-z0-9-]*$/)

/** A wait as a graph view shows it: a whole number of minutes, hours or days ("30m", "2h", "1d"). */
const waitDuration = keyText.regex(/^\d{1,4}[dhm]$/)


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

/** One provider a node lists: its kind, its provider or any, its connection or none yet; `operations` only on a stored legacy node. */
const account = z.strictObject({
    kind: key,
    provider: keyText.min(1).nullable(),
    connectionId: keyText.min(1).nullable(),
    operations: z.record(keyText.min(1), z.enum(["auto", "ask"])).refine(entriesAtMost(100)).optional(),
})

const node = z.strictObject({
    key,
    kind: z.enum(["trigger", "condition", "execute", "output"]),
    step: keyText.min(1),
    params: z.record(keyText, jsonValue).refine(entriesAtMost(200)).optional(),
    input: z.record(keyText, binding).refine(entriesAtMost(200)).optional(),
    next: key.optional(),
    routes: z.record(keyText, key).refine(entriesAtMost(50)).optional(),
    blocking: z.boolean().optional(),
    group: key.optional(),
    wait: z
        .strictObject({
            kind: z.enum(["reply", "payment", "other"]),
            timeout: waitDuration.optional(),
            reminder: waitDuration.optional(),
        })
        .optional(),
    // `auto` or a model id (`claude-sonnet-5-5`, `deepseek/deepseek-v4.1-flash`); the host checks it against its vocabulary.
    model: keyText.regex(/^[a-z0-9][a-z0-9./:-]{0,79}$/).optional(),
    mode: z.enum(["auto", "ask"]).optional(),
    accounts: z.array(account).max(50).optional(),
})

const source = z.enum(["channel", "chats-group", "agent", "system-event", "schedule"])

/** The structure of an agent graph spec; the nodes are judged against the installed ones by `graphSpecProblems`. */
export const graphSpecSchema: z.ZodType<GraphSpec> = z.strictObject({
    schema: z.literal("nivo/agent-graph@1"),
    moduleKey: keyText.regex(/^[a-z][a-z0-9_]{1,23}$/),
    contract: workflowContractSchema.optional(),
    triggers: workflowTriggersSchema.optional(),
    outcomes: workflowOutcomesSchema.optional(),
    entry: workflowEntrySchema.optional(),
    trigger: z.strictObject({
        kind: z.literal("tag"),
        sources: z.array(source).min(1).max(5),
    }),
    // A stored grant from before the data rights were deleted carries `rights`: dropped, so an old spec or workflow row still parses.
    grant: z.preprocess(
        withoutMember("rights"),
        z.strictObject({
            tools: z.array(keyText).max(100),
            effects: z.array(keyText).max(100),
        }),
    ),
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
