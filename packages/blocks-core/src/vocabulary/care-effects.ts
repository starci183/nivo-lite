import { defineEffect } from "@nivo-lite/agent-sdk/node"
import type { EffectDefinition } from "@nivo-lite/agent-sdk/node"
import { z } from "zod"
import { MAX_ID } from "../bounds"
import { careTitle } from "../nodes/sales/care.copy"
import { CARE_KINDS } from "../nodes/sales/care.policy"
import type { CareKind } from "../nodes/sales/care.policy"
import { TOOL } from "./tool-ids"

/** A care step to wake the Sales agent for at a given moment: it becomes a task of the agent that the minute sweep wakes the agent from. */
export interface CareSchedulePayload {
    /** Which care step. */
    readonly kind: CareKind
    /** The record the step is about: the order, or the customer for an occasion. */
    readonly ref: string
    /** When the step is due, an ISO instant; or `afterHours` instead. */
    readonly dueAt?: string | undefined
    /**
     * In how many hours from now the step is due, when no `dueAt` is given: the engine adds them to its own clock, so an agent that
     * reads a timing from its policy (`paymentReminderHours`) never types an instant.
     */
    readonly afterHours?: number | undefined
    /** Tells two steps of one kind on one record apart (the occasion), or absent. */
    readonly suffix?: string | undefined
}

const id = z.string().min(1).max(MAX_ID)

/** The longest wait an `afterHours` may name: the 90 days a care timer may lie ahead. */
const AFTER_HOURS_MAX = 90 * 24

const careSchedulePayload: z.ZodType<CareSchedulePayload> = z
    .object({
        kind: z.enum(CARE_KINDS).describe("Which care step to wake for."),
        ref: id.describe("The record the step is about: the order, or the customer for an occasion."),
        dueAt: z.iso.datetime().max(40).optional().describe("When the step is due, an ISO instant; or give afterHours."),
        afterHours: z
            .number()
            .positive()
            .max(AFTER_HOURS_MAX)
            .optional()
            .describe("In how many hours from now the step is due, e.g. a timing read from the policy; or give dueAt."),
        suffix: z.string().max(60).regex(/^[a-z0-9-]{1,60}$/).optional(),
    })
    .refine((payload) => (payload.dueAt === undefined) !== (payload.afterHours === undefined), {
        message: "Give exactly one of dueAt and afterHours",
    })

/**
 * Arms a care step: the Sales agent is woken for it at the given moment (a tag with `event: "care.due"`, the step, and the record). Arming
 * the same step and record again moves it; the subject is the task that holds it. A moment more than seven days ahead is reached by arming again on each wake.
 */
export const careScheduleEffect: EffectDefinition<z.ZodType<CareSchedulePayload>> = defineEffect({
    id: TOOL.careSchedule,
    title: careTitle("effectCareSchedule"),
    payload: careSchedulePayload,
    rights: [],
})

