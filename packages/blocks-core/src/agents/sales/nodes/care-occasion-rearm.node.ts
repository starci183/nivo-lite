import { TOOL } from "@nivo-lite/agent-sdk/names"
import { defineTemplateNode, type TemplateNode } from "@nivo-lite/agent-sdk/template"
import { z } from "zod"
import { MAX_ID } from "../../../shared/bounds"
import type { NodeSchema } from "../../../shared/nodes/node-schema.types"
import { occasionDueSchema, type OccasionDue } from "./care-occasion-wait.node"
import { ARMED } from "./care.examples"
import { nextYearsWriteAtOf } from "./care.policy"
import { armCare, careTimerArgsOf } from "./care.steps"
import { refused } from "../../../shared/nodes/tool-answers"

/** What the re-arm is given: the customer and the occasion just handled. */
export interface CareOccasionRearmInput {
    /** The customer (`= steps.wait.output.leadId`). */
    readonly leadId: string
    /** The occasion just handled (`= steps.wait.output.due`), or null. */
    readonly due: OccasionDue | null
}

/** What the re-arm did. */
export interface CareOccasionRearmOutput {
    /** The customer, echoed. */
    readonly leadId: string
    /** When next year's suggestion is written (ISO), or null for a one-off date. */
    readonly nextAt: string | null
    /** True when a person declined arming next year's timer on its card: nothing was armed; the graph ends `declined`. */
    readonly declined: boolean
}

/** What the owner sets for the occasion step. */
export interface CareOccasionRearmParams {
    /** How many days before a date the customer mentioned the shop writes. */
    readonly occasionLeadDays: number
}

const params: NodeSchema<CareOccasionRearmParams, { occasionLeadDays?: number | undefined }> = z.object({
    occasionLeadDays: z.number().int().min(1).max(30).default(7),
})

const input: NodeSchema<CareOccasionRearmInput> = z.object({
    leadId: z.string().max(MAX_ID).min(1),
    due: occasionDueSchema.nullable(),
})

const output: NodeSchema<CareOccasionRearmOutput> = z.object({
    leadId: z.string().max(MAX_ID).describe("The id of the customer, as given."),
    nextAt: z.string().max(40).nullable().describe("When next year's suggestion is written (ISO), or null."),
    declined: z.boolean().describe("True when a person declined arming next year's timer on its card."),
})

/** The yearly birthday just handled, in the examples. */
const DUE: OccasionDue = {
    occasionId: "occ-1",
    label: "birthday",
    month: 1,
    day: 5,
    year: null,
    on: "1970-01-04T17:00:00.000Z",
    recipient: "her",
    lastOrder: { orderNo: "DH-1", items: "1 x roses" },
}

/**
 * `sales.care-occasion-rearm` (Hen dip nam sau): exact date arithmetic, so code, no AI. Once a yearly date was handled, arms ONE timer
 * `occasionLeadDays` before its next occurrence (`nivo.tool.timer.arm`, kind `occasion`, ref the customer, item the occasion);
 * a one-off date arms nothing.
 */
export const salesCareOccasionRearmNode: TemplateNode<typeof input, typeof output, typeof params> = defineTemplateNode({
    id: "sales.care-occasion-rearm",
    title: { key: "nodeSalesCareOccasionRearmTitle" },
    description: { vi: "Sau khi x\u1eed l\u00fd m\u1ed9t ng\u00e0y l\u1eb7p l\u1ea1i h\u1eb1ng n\u0103m c\u1ee7a kh\u00e1ch, h\u1eb9n nh\u1eafc cho n\u0103m sau.", en: "Once a yearly date of the customer has been handled, schedules the reminder for next year." },
    tools: [],
    mode: "auto",
    accounts: [],
    input,
    output,
    params,
    run: async (given, context) => {
        const due = given.due
        const nextAt = due === null ? null : nextYearsWriteAtOf(due, due.on, context.params.occasionLeadDays)
        if (due === null || nextAt === null) return { leadId: given.leadId, nextAt: null, declined: false }
        const arm = await armCare(context, {
            kind: "occasion",
            ref: given.leadId,
            item: due.occasionId,
            dueAt: nextAt,
        })
        if (arm.declined) return { leadId: given.leadId, nextAt: null, declined: true }
        return { leadId: given.leadId, nextAt, declined: false }
    },
    examples: [
        {
            name: "a yearly birthday just handled arms next year's suggestion a week before it",
            params: { occasionLeadDays: 7 },
            input: { leadId: "l1", due: DUE },
            tools: [
                {
                    id: TOOL.timerArm,
                    args: careTimerArgsOf({ kind: "occasion", ref: "l1", item: "occ-1", dueAt: "1970-12-28T17:00:00.000Z" }),
                    answer: ARMED,
                },
            ],
            output: { leadId: "l1", nextAt: "1970-12-28T17:00:00.000Z", declined: false },
        },
        {
            name: "run now on a date still far away: next year is counted from the occurrence handled",
            params: { occasionLeadDays: 7 },
            input: { leadId: "l1", due: { ...DUE, month: 6, day: 1, on: "1970-05-31T17:00:00.000Z" } },
            tools: [
                {
                    id: TOOL.timerArm,
                    args: careTimerArgsOf({ kind: "occasion", ref: "l1", item: "occ-1", dueAt: "1971-05-24T17:00:00.000Z" }),
                    answer: ARMED,
                },
            ],
            output: { leadId: "l1", nextAt: "1971-05-24T17:00:00.000Z", declined: false },
        },
        {
            name: "a one-off date arms nothing",
            params: {},
            input: { leadId: "l1", due: { ...DUE, year: 1970 } },
            output: { leadId: "l1", nextAt: null, declined: false },
        },
        {
            name: "next year's timer the schedule tool refuses ends the step, never reported as armed",
            params: { occasionLeadDays: 7 },
            input: { leadId: "l1", due: DUE },
            tools: [
                {
                    id: TOOL.timerArm,
                    args: careTimerArgsOf({ kind: "occasion", ref: "l1", item: "occ-1", dueAt: "1970-12-28T17:00:00.000Z" }),
                    answer: refused("invalid_arguments"),
                },
            ],
            failure: { kind: "cannot", why: "nivo.tool.timer.arm refused: invalid_arguments" },
        },
        {
            name: "a person declines next year's timer: nothing is armed and the step says declined",
            params: { occasionLeadDays: 7 },
            input: { leadId: "l1", due: DUE },
            tools: [
                {
                    id: TOOL.timerArm,
                    args: careTimerArgsOf({ kind: "occasion", ref: "l1", item: "occ-1", dueAt: "1970-12-28T17:00:00.000Z" }),
                    answer: refused("declined"),
                },
            ],
            output: { leadId: "l1", nextAt: null, declined: true },
        },
    ],
})
