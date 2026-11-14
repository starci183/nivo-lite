import { OUTCOME_STEP, defineNode, type NodeDefinition } from "@nivo-lite/agent-sdk/node"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { MAX_ID } from "../../bounds"
import { boundedRecord } from "../../json.schema"
import { bilingualOf } from "../../messages/catalog"
import type { NodeSchema } from "../node-schema.types"

/** The setting: the outcome of the workflow this end reaches. */
export interface OutcomeParams {
    /** The name of the outcome the run ends with. */
    readonly outcome: string
}

/** What the end hands on: the outcome's outputs, each read from its ref or written as a fixed value. */
export interface OutcomeInput {
    /** The values the workflow reports with its outcome, keyed by name. */
    readonly outputs: Readonly<Record<string, JsonValue>>
}

/** What it answers, which the steps after it read as `out.<name>`. */
export interface OutcomeOutput {
    /** The name of the outcome the run ended with. */
    readonly outcome: string
    /** The values reported with the outcome, keyed by name. */
    readonly values: Readonly<Record<string, JsonValue>>
}

const params: NodeSchema<OutcomeParams> = z.object({ outcome: z.string().min(1).max(MAX_ID) })
const input: NodeSchema<OutcomeInput> = z.object({ outputs: boundedRecord })
const output: NodeSchema<OutcomeOutput> = z.object({ outcome: z.string().max(MAX_ID), values: boundedRecord })

/**
 * `core.outcome`: an end of a workflow on one of its named business outcomes ("Chot mua", "Khach khong mua"), filling the outputs the
 * outcome declares; the save checks they are all there with fitting types. It may end the run, or go on to the hand-offs that call the
 * next workflows, which map `out.<name>`. It touches nothing.
 */
export const coreOutcomeNode: NodeDefinition<typeof input, typeof output, typeof params> = defineNode({
    id: OUTCOME_STEP,
    role: "output",
    title: bilingualOf("nodeCoreOutcomeTitle"),
    params,
    input,
    output,
    effects: [],
    run: (given, context) => Promise.resolve({ outcome: context.params.outcome, values: { ...given.outputs } }),
    examples: [
        {
            name: "answers the outcome with the outputs it fills",
            params: { outcome: "won" },
            input: { outputs: { items: [{ name: "Hoa h\u1ed3ng", quantity: 1 }], address: "69 H\u00e0ng Xanh" } },
            output: { outcome: "won", values: { items: [{ name: "Hoa h\u1ed3ng", quantity: 1 }], address: "69 H\u00e0ng Xanh" } },
            effects: [],
        },
    ],
})
