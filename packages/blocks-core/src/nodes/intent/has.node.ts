import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import type { NodeSchema } from "../node-schema.types"
import { intentSchema } from "./classify.schema"
import type { Intent } from "./classify.types"
import { bilingualOf } from "../../messages/catalog"

/** The per-graph settings: the intent to look for. */
interface HasParams {
    readonly intent: Intent
}

/** The intents a batch raised. */
interface HasInput {
    readonly intents: ReadonlyArray<Intent>
}

/** The way the graph goes on. */
interface HasOutput {
    readonly branch: "yes" | "no"
}

const intent: NodeSchema<Intent> = intentSchema
const INTENTS_MAX = 8

const params: NodeSchema<HasParams> = z.object({ intent })
const input: NodeSchema<HasInput> = z.object({ intents: z.array(intent).max(INTENTS_MAX) })
const output: NodeSchema<HasOutput> = z.object({ branch: z.enum(["yes", "no"]) })

/** `intent.has`: a pure condition; goes `yes` when the batch raised the intent its params name, `no` otherwise. */
export const intentHasNode: NodeDefinition<
    NodeSchema<HasInput>,
    NodeSchema<HasOutput>,
    NodeSchema<HasParams>
> = defineNode({
    id: "intent.has",
    role: "condition",
    title: bilingualOf("nodeIntentHasTitle"),
    params,
    input,
    output,
    rights: [],
    effects: [],
    run: (given, context) => Promise.resolve({ branch: given.intents.includes(context.params.intent) ? "yes" : "no" }),
    examples: [
        {
            name: "yes when the batch raised the intent",
            params: { intent: "payment_claim" },
            input: { intents: ["order", "payment_claim"] },
            output: { branch: "yes" },
            effects: [],
        },
        {
            name: "no when it did not",
            params: { intent: "payment_claim" },
            input: { intents: ["question"] },
            output: { branch: "no" },
            effects: [],
        },
    ],
})
