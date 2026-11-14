import { TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID } from "../../bounds"
import type { NodeSchema } from "../node-schema.types"
import { ARMED, CARE_OPEN, EXAMPLE_AT } from "./care.examples"
import { occasionStandingOf, schedulable } from "./care.policy"
import { careFactsOf } from "./care.reads"
import { armCare, careTimerArgsOf } from "./care.steps"
import { answered, refused } from "../tool-answers"

/** What the occasion plan is given: the customer of the paid order. */
export interface CarePlanOccasionsInput {
    /** The customer (`= steps.thank.output.leadId`), or null when the order has none. */
    readonly leadId: string | null
}

/** What the occasion plan armed. */
export interface CarePlanOccasionsOutput {
    /** The customer, echoed. */
    readonly leadId: string | null
    /** How many occasion reminders were armed. */
    readonly armed: number
    /** True when a person declined arming a reminder on its card: the remaining ones are not armed; the graph ends `declined`. */
    readonly declined: boolean
}

/** What the owner sets for the care that follows a sale. */
export interface CarePlanOccasionsParams {
    /** How many days before a date the customer mentioned the shop writes a gentle suggestion to order again. */
    readonly occasionLeadDays: number
}

const params: NodeSchema<CarePlanOccasionsParams, { occasionLeadDays?: number | undefined }> = z.object({
    occasionLeadDays: z.number().int().min(1).max(30).default(7),
})

const input: NodeSchema<CarePlanOccasionsInput> = z.object({ leadId: z.string().max(MAX_ID).min(1).nullable() })

const output: NodeSchema<CarePlanOccasionsOutput> = z.object({
    leadId: z.string().max(MAX_ID).nullable().describe("The customer, as given."),
    armed: z.number().int().min(0).describe("How many occasion reminders were armed."),
    declined: z.boolean().describe("True when a person declined arming a reminder on its card; `armed` counts those armed before it."),
})

/**
 * `sales.care-plan-occasions` (Hen nhac dip): for each date the customer mentioned (`nivo.tool.lead.care.get`: a birthday, an
 * anniversary, each with its own `occasionId`), arms ONE reminder `occasionLeadDays` before its next occurrence
 * (`nivo.tool.timer.arm`, kind `occasion`, ref the customer, item the occasion). Exact date arithmetic, so code, no AI. A date
 * already inside the lead time or past is not armed here; the timer's identity is the engine's (`kind` + `ref` + `item`).
 */
export const salesCarePlanOccasionsNode: TemplateNode<typeof input, typeof output, typeof params> = defineTemplateNode({
    id: "sales.care-plan-occasions",
    title: { key: "nodeSalesCarePlanOccasionsTitle" },
    description: { vi: "V\u1edbi m\u1ed7i ng\u00e0y \u0111\u1eb7c bi\u1ec7t kh\u00e1ch t\u1eebng k\u1ec3 (sinh nh\u1eadt, k\u1ef7 ni\u1ec7m), h\u1eb9n nh\u1eafc tr\u01b0\u1edbc ng\u00e0y \u0111\u00f3.", en: "For each special date the customer mentioned (birthday, anniversary), schedules a reminder ahead of it." },
    tools: [TOOL.leadCareGet],
    mode: "auto",
    accounts: [],
    input,
    output,
    params,
    run: async (given, context) => {
        if (given.leadId === null) return { leadId: null, armed: 0, declined: false }
        const facts = await careFactsOf(context, given.leadId)
        if (facts === null || facts.optedOut) return { leadId: given.leadId, armed: 0, declined: false }
        const ahead = facts.occasions.flatMap((occasion) => {
            const standing = occasionStandingOf(occasion, context.run.at, context.params.occasionLeadDays)
            return standing.kind === "later" && schedulable(standing.writeAt, context.run.at)
                ? [{ item: occasion.occasionId, dueAt: standing.writeAt }]
                : []
        })
        let armed = 0
        for (const one of ahead) {
            const arm = await armCare(context, { kind: "occasion", ref: given.leadId, ...one })
            if (arm.declined) return { leadId: given.leadId, armed, declined: true }
            armed += 1
        }
        return { leadId: given.leadId, armed, declined: false }
    },
    examples: [
        {
            name: "arms a reminder a week before a date the customer mentioned, and none for a date already inside the lead time",
            params: { occasionLeadDays: 7 },
            at: EXAMPLE_AT,
            input: { leadId: "l1" },
            tools: [
                {
                    id: TOOL.leadCareGet,
                    args: { leadId: "l1" },
                    answer: answered({
                        ...CARE_OPEN,
                        occasions: [
                            { occasionId: "occ-1", label: "birthday", month: 2, day: 1, year: null },
                            { occasionId: "occ-2", label: "anniversary", month: 1, day: 5, year: null },
                        ],
                    }),
                },
                {
                    id: TOOL.timerArm,
                    args: careTimerArgsOf({ kind: "occasion", ref: "l1", item: "occ-1", dueAt: "1970-01-24T17:00:00.000Z" }),
                    answer: ARMED,
                },
            ],
            output: { leadId: "l1", armed: 1, declined: false },
        },
        {
            name: "a customer who asked to be left alone gets no reminder armed",
            params: {},
            at: EXAMPLE_AT,
            input: { leadId: "l1" },
            tools: [
                {
                    id: TOOL.leadCareGet,
                    args: { leadId: "l1" },
                    answer: answered({
                        ...CARE_OPEN,
                        optedOut: true,
                        occasions: [{ occasionId: "occ-1", label: "birthday", month: 2, day: 1, year: null }],
                    }),
                },
            ],
            output: { leadId: "l1", armed: 0, declined: false },
        },
        {
            name: "a care read it cannot read stops the step: never taken for an opt-out or for no dates",
            params: {},
            at: EXAMPLE_AT,
            input: { leadId: "l1" },
            tools: [
                { id: TOOL.leadCareGet, args: { leadId: "l1" }, answer: answered({ leadId: "l1", optedOut: "maybe" }) },
            ],
            failure: { kind: "cannot", why: "nivo.tool.lead.care.get answered a shape care cannot read" },
        },
        {
            name: "an order with no customer arms nothing and reads nothing",
            params: {},
            at: EXAMPLE_AT,
            input: { leadId: null },
            output: { leadId: null, armed: 0, declined: false },
        },
        {
            name: "a reminder the schedule tool refuses ends the step, never counted as armed",
            params: { occasionLeadDays: 7 },
            at: EXAMPLE_AT,
            input: { leadId: "l1" },
            tools: [
                {
                    id: TOOL.leadCareGet,
                    args: { leadId: "l1" },
                    answer: answered({
                        ...CARE_OPEN,
                        occasions: [{ occasionId: "occ-1", label: "birthday", month: 2, day: 1, year: null }],
                    }),
                },
                {
                    id: TOOL.timerArm,
                    args: careTimerArgsOf({ kind: "occasion", ref: "l1", item: "occ-1", dueAt: "1970-01-24T17:00:00.000Z" }),
                    answer: refused("invalid_arguments"),
                },
            ],
            failure: { kind: "cannot", why: "nivo.tool.timer.arm refused: invalid_arguments" },
        },
        {
            name: "a person declines the first reminder's timer: nothing more is armed and the step says declined",
            params: { occasionLeadDays: 7 },
            at: EXAMPLE_AT,
            input: { leadId: "l1" },
            tools: [
                {
                    id: TOOL.leadCareGet,
                    args: { leadId: "l1" },
                    answer: answered({
                        ...CARE_OPEN,
                        occasions: [{ occasionId: "occ-1", label: "birthday", month: 2, day: 1, year: null }],
                    }),
                },
                {
                    id: TOOL.timerArm,
                    args: careTimerArgsOf({ kind: "occasion", ref: "l1", item: "occ-1", dueAt: "1970-01-24T17:00:00.000Z" }),
                    answer: refused("declined"),
                },
            ],
            output: { leadId: "l1", armed: 0, declined: true },
        },
    ],
})
