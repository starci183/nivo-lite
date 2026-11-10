import { defineNode } from "@nivo-lite/agent-sdk/node"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import { z } from "zod"
import { boundedJson } from "../../json.schema"
import { bilingualOf } from "../../messages/catalog"
import type { NodeSchema } from "../node-schema.types"

/** How a condition compares its value. */
export type IfOp = "equals" | "not-equals" | "in" | "present" | "absent" | "greater" | "less"

/** Every comparison, in the order the editor lists them. */
export const IF_OPS: ReadonlyArray<IfOp> = ["equals", "not-equals", "in", "present", "absent", "greater", "less"]

/** The settings: how it compares, and with what (a list for `in`; nothing for `present` and `absent`). */
export interface IfParams {
    readonly op: IfOp
    readonly compare: JsonValue
}

/** What it reads: the value a ref binds (a step's output or error, a lead fact, the memory of another workflow). */
export interface IfInput {
    readonly value: JsonValue
}

/** Which way the run goes. */
export interface IfOutput {
    readonly branch: "yes" | "no"
}

const params: NodeSchema<IfParams, { readonly op: IfOp; readonly compare?: JsonValue | undefined }> = z.object({
    op: z.enum(["equals", "not-equals", "in", "present", "absent", "greater", "less"]),
    compare: boundedJson.default(null),
})
const input: NodeSchema<IfInput> = z.object({ value: boundedJson })
const output: NodeSchema<IfOutput> = z.object({ branch: z.enum(["yes", "no"]) })

const same = (left: JsonValue, right: JsonValue): boolean => JSON.stringify(left) === JSON.stringify(right)

const isPresent = (value: JsonValue): boolean =>
    value !== null && value !== "" && !(Array.isArray(value) && value.length === 0)

/** Whether a value meets a comparison. */
export const ifHolds = (value: JsonValue, op: IfOp, compare: JsonValue): boolean => {
    switch (op) {
        case "equals":
            return same(value, compare)
        case "not-equals":
            return !same(value, compare)
        case "in":
            return Array.isArray(compare) && compare.some((member) => same(member, value))
        case "present":
            return isPresent(value)
        case "absent":
            return !isPresent(value)
        case "greater":
            return typeof value === "number" && typeof compare === "number" && value > compare
        case "less":
            return typeof value === "number" && typeof compare === "number" && value < compare
    }
}

/**
 * `core.if` ("Nếu"): the one business condition an owner writes in a graph. It compares a value a ref reads (what a step answered or
 * why it failed, a lead fact, another workflow's memory) and goes the `yes` or the `no` way. A rule of the engine (a retry, a frozen
 * lead, a duplicate run) is never written with it.
 */
export const coreIfNode: NodeDefinition<typeof input, typeof output, typeof params> = defineNode({
    id: "core.if",
    role: "condition",
    title: bilingualOf("nodeCoreIfTitle"),
    params,
    input,
    output,
    rights: [],
    effects: [],
    run: (given, context) =>
        Promise.resolve({ branch: ifHolds(given.value, context.params.op, context.params.compare) ? "yes" : "no" }),
    examples: [
        {
            name: "yes while the sales consult of the lead is still open",
            params: { op: "in", compare: ["discover", "recommend", "close"] },
            input: { value: "recommend" },
            output: { branch: "yes" },
            effects: [],
        },
        {
            name: "no when the payment check failed for another reason",
            params: { op: "equals", compare: "payment_mismatch" },
            input: { value: "no_arrival" },
            output: { branch: "no" },
            effects: [],
        },
    ],
})
