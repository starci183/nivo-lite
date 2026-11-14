import { z } from "zod"
import { MAX_ID } from "../../../bounds"
import type { NodeSchema } from "../../../nodes/node-schema.types"
import { CARE_KINDS, type CareKind } from "../../../nodes/sales/care.policy"

/** The data a care timer carries back (`nivo.tool.timer.arm` `data`, as `careTimerArgsOf` wrote it). */
export type CareTimerMembers = {
    /** The care step the timer was armed for: the field every timer graph of the agent keys on. */
    readonly kind: CareKind
    /** The record it is about (an order, a customer). */
    readonly record: string
    /** The item within the record (an occasion), when the timer has one. */
    readonly item?: string | null | undefined
    /** How many looks for the shipment this timer is, when it carries them. */
    readonly shipWaits?: number | null | undefined
}

/** What `nivo.trigger.timer.due` supplies for a care timer, in the event's data: its key, the data it was armed with, and the moment it was really due. */
export type CareTimerInput = {
    /** The timer event's data (the one pipeline's trigger scope). */
    readonly data: {
        /** The timer's key. */
        readonly ref: string
        /** The data it was armed with. */
        readonly data: CareTimerMembers
        /** The moment it was really due. */
        readonly dueAt?: string | null | undefined
    }
}

/**
 * The input contract of a graph woken by a care timer (`nivo.tool.timer.arm`, the engine's generic timer), all in the event's data: the
 * key, the armed data (`kind`, `record`, `item`, `shipWaits`) and the due moment. The person (`contactId`, `routeId`) rides as generic members.
 */
export const careTimerInput: NodeSchema<CareTimerInput> = z.object({
    data: z.object({
        ref: z.string().min(1).max(MAX_ID),
        data: z.object({
            kind: z.enum(CARE_KINDS),
            record: z.string().min(1).max(MAX_ID),
            item: z.string().max(MAX_ID).nullish(),
            shipWaits: z.number().int().min(0).nullish(),
        }),
        dueAt: z.string().max(40).nullish(),
    }),
})

/** The trigger condition of the graph a care timer of `kind` wakes: the one field of the armed data (`data.data.kind`) every timer graph of the agent keys on. */
export const careTimerWhereOf = (kind: CareKind): ReadonlyArray<{ readonly param: string; readonly op: "equals"; readonly value: string }> => [
    { param: "data.data.kind", op: "equals", value: kind },
]
