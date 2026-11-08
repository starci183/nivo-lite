import { defineNode, type NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import { DEFAULT_THRESHOLD_VND, needsOwner } from "../../rules/sales/settings"
import type { NodeSchema } from "../node-schema.types"
import { bilingualOf } from "../../messages/catalog"

/** The setting of the graph: from which amount the owner decides. */
export interface NeedsApprovalParams {
    /** An order of this amount or more waits for the owner. */
    readonly thresholdVnd: number
}

/** The order to judge. */
export interface NeedsApprovalInput {
    /** The amount of the order, VND. */
    readonly amountVnd: number
}

/** Who decides; the graph routes on it. */
export interface NeedsApprovalOutput {
    /** `approve-self` below the threshold; `awaiting-owner` at or above it. */
    readonly branch: "approve-self" | "awaiting-owner"
}

const params: z.ZodType<NeedsApprovalParams, { thresholdVnd?: number | undefined }> = z.object({
    thresholdVnd: z.number().min(0).default(DEFAULT_THRESHOLD_VND),
})

const input: NodeSchema<NeedsApprovalInput> = z.object({ amountVnd: z.number().min(0) })

const output: NodeSchema<NeedsApprovalOutput> = z.object({ branch: z.enum(["approve-self", "awaiting-owner"]) })

/** `order.needs-approval`: the condition "does the owner decide?": an order at the threshold or above waits for the owner. */
export const orderNeedsApprovalNode: NodeDefinition<typeof input, typeof output, typeof params> = defineNode({
    id: "order.needs-approval",
    role: "condition",
    title: bilingualOf("nodeOrderNeedsApprovalTitle"),
    params,
    input,
    output,
    rights: [],
    effects: [],
    run: (given, context) =>
        Promise.resolve({
            branch: needsOwner(given.amountVnd, { approvalThresholdVnd: context.params.thresholdVnd })
                ? "awaiting-owner"
                : "approve-self",
        }),
    examples: [
        {
            name: "lets the shop approve an order below the default threshold",
            params: {},
            input: { amountVnd: 4_999_999 },
            output: { branch: "approve-self" },
            effects: [],
        },
        {
            name: "leaves the order to the owner at the default threshold",
            params: {},
            input: { amountVnd: 5_000_000 },
            output: { branch: "awaiting-owner" },
            effects: [],
        },
        {
            name: "follows the threshold the graph sets",
            params: { thresholdVnd: 1_000_000 },
            input: { amountVnd: 1_000_000 },
            output: { branch: "awaiting-owner" },
            effects: [],
        },
    ],
})
