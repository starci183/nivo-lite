import { LOOP_MAX, LOOP_STEP, defineNode, type LoopOutput, type NodeDefinition } from "@nivo-lite/agent-sdk/node"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { boundedJson } from "../../json.schema"
import { bilingualOf } from "../../messages/catalog"
import type { NodeSchema } from "../node-schema.types"

/** The most items one loop runs in a round: the items past it are not run and are counted in `held`, never a silent cut. */
export const FOR_EACH_MAX: number = LOOP_MAX

/** The longest name of a body node or of an item member the settings take. */
const NAME_MAX = 200

/** The settings: the most items the loop runs, the body node whose output it gathers, the member that is an item's identity. */
export interface ForEachParams {
    /** The most items one loop goes through; a longer list is cut here. */
    readonly max: number
    /** The key of the body output gathered from each pass; nothing is gathered when absent. */
    readonly collect?: string | undefined
    /** The name under which the body reads the item of the current pass. */
    readonly itemKey?: string | undefined
}

/** What it loops over: the list its `items` ref reads. */
export interface ForEachInput {
    /** The list the loop goes through, one pass per item. */
    readonly items: ReadonlyArray<JsonValue>
}

const params: NodeSchema<
    ForEachParams,
    { readonly max?: number | undefined; readonly collect?: string | undefined; readonly itemKey?: string | undefined }
> = z.object({
    max: z.number().int().min(1).max(FOR_EACH_MAX).default(FOR_EACH_MAX),
    collect: z.string().min(1).max(NAME_MAX).optional(),
    itemKey: z.string().min(1).max(NAME_MAX).optional(),
})
const input: NodeSchema<ForEachInput> = z.object({ items: z.array(boundedJson).max(1000) })
const output: NodeSchema<LoopOutput> = z.object({
    items: z.array(z.object({ key: z.string().max(NAME_MAX), output: boundedJson })).max(FOR_EACH_MAX),
    held: z.object({ count: z.number().int().positive(), firstKey: z.string().max(NAME_MAX) }).nullable(),
    results: z.array(boundedJson).max(FOR_EACH_MAX),
})

/**
 * `core.for-each` ("Lap qua tung"): runs its body (the node of its `body` route and the nodes that follow it) once per element of
 * `items`, each iteration reading `item.<field>` and `item.$index`. The ENGINE drives the items and fills the output: per item run, its
 * identity (the `itemKey` member, else its index) and the output of the `collect` body node (null when the item's route did not reach
 * it); the items past `max` are not run and are counted in `held` (how many, and the first one's identity) for the report to tell.
 * `results` repeats the gathered outputs for the templates that still read it (deprecated). The node itself answers only for a body the
 * engine does not run: every item with a null output, keyed by its index.
 */
export const coreForEachNode: NodeDefinition<typeof input, typeof output, typeof params> = defineNode({
    id: LOOP_STEP,
    role: "execute",
    title: bilingualOf("nodeCoreForEachTitle"),
    params,
    input,
    output,
    effects: [],
    run: (given, context) => {
        const ran = given.items.slice(0, context.params.max).map((_item, index) => ({ key: String(index), output: null }))
        const rest = given.items.length - ran.length
        return Promise.resolve({
            items: ran,
            held: rest > 0 ? { count: rest, firstKey: String(ran.length) } : null,
            results: ran.map(() => null),
        })
    },
    examples: [
        {
            name: "answers each element of the list for an empty body",
            params: {},
            input: { items: [{ name: "Hoa h\u1ed3ng" }, { name: "Hoa lan" }] },
            output: {
                items: [
                    { key: "0", output: null },
                    { key: "1", output: null },
                ],
                held: null,
                results: [null, null],
            },
            effects: [],
        },
        {
            name: "runs the first max items and holds the rest",
            params: { max: 2 },
            input: { items: ["a", "b", "c"] },
            output: {
                items: [
                    { key: "0", output: null },
                    { key: "1", output: null },
                ],
                held: { count: 1, firstKey: "2" },
                results: [null, null],
            },
            effects: [],
        },
    ],
})
