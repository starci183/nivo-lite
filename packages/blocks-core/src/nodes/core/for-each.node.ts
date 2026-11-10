import { LOOP_STEP, defineNode } from "@nivo-lite/agent-sdk/node"
import type { LoopOutput, NodeDefinition } from "@nivo-lite/agent-sdk/node"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { boundedJson, boundedRecord } from "../../json.schema"
import { bilingualOf, messageOf } from "../../messages/catalog"
import type { NodeSchema } from "../node-schema.types"

/** The most items one loop runs: a longer list is a business failure, never a silent cut. */
export const FOR_EACH_MAX = 50

/** The code of the failure of a list longer than the loop's `max`. */
export const LIST_TOO_LONG = "list_too_long"

/** The settings: the most items the loop takes. */
export interface ForEachParams {
    readonly max: number
}

/** What it loops over: the list its `items` ref reads. */
export interface ForEachInput {
    readonly items: ReadonlyArray<JsonValue>
}

const params: NodeSchema<ForEachParams, { readonly max?: number | undefined }> = z.object({
    max: z.number().int().min(1).max(FOR_EACH_MAX).default(FOR_EACH_MAX),
})
const input: NodeSchema<ForEachInput> = z.object({ items: z.array(boundedJson).max(1000) })
const failure = z.object({
    code: z.string().max(200),
    messageKey: z.string().max(200),
    message: z.string().max(2000),
    fields: boundedRecord,
})
const output: NodeSchema<LoopOutput> = z.object({
    results: z.array(boundedJson).max(FOR_EACH_MAX),
    okCount: z.number().int().nonnegative(),
    failed: z.array(z.object({ index: z.number().int().nonnegative(), error: failure })).max(FOR_EACH_MAX),
})

/**
 * `core.for-each` ("Lặp qua từng"): runs its body (the node of its `body` route and the nodes that follow it) once per element of
 * `items`, each iteration reading `item.<field>` and `item.$index`. The engine drives the iterations and fills `results` (the output of
 * each iteration's last body node, null for a failed one) and `failed` (an iteration whose body ended in a business failure). The node
 * itself checks the list and answers for an empty body. A list longer than `max` is a business failure (`list_too_long`), so the graph
 * may route it to "Lỗi".
 */
export const coreForEachNode: NodeDefinition<typeof input, typeof output, typeof params> = defineNode({
    id: LOOP_STEP,
    role: "execute",
    title: bilingualOf("nodeCoreForEachTitle"),
    params,
    input,
    output,
    rights: [],
    effects: [],
    run: (given, context) => {
        if (given.items.length > context.params.max) {
            return context.fail({
                code: LIST_TOO_LONG,
                messageKey: "nodeFailureCoreForEachListTooLong",
                message: messageOf("vi", "nodeFailureCoreForEachListTooLong"),
                fields: { count: given.items.length, max: context.params.max },
            })
        }
        return Promise.resolve({ results: given.items.map(() => null), okCount: given.items.length, failed: [] })
    },
    examples: [
        {
            name: "answers each element of the list for an empty body",
            params: {},
            input: { items: [{ name: "Hoa hồng" }, { name: "Hoa lan" }] },
            output: { results: [null, null], okCount: 2, failed: [] },
            effects: [],
        },
    ],
})
