import { z } from "zod"
import type { GraphNodeApproval, GraphNodeStepInput } from "./policies/graph-flow.policy"

/** The most effects, and entries of a trigger, a stored step is read with. */
const MAX_ENTRIES = 500

/** A value a trigger scope holds: JSON, bounded in text, depth of the structure and count of members. */
type TriggerValue =
    | string
    | number
    | boolean
    | null
    | undefined
    | ReadonlyArray<TriggerValue>
    | { readonly [member: string]: TriggerValue }

const triggerValueSchema: z.ZodType<TriggerValue> = z.lazy(() =>
    z.union([
        z.string().max(100_000),
        z.number(),
        z.boolean(),
        z.null(),
        z.undefined(),
        z.array(triggerValueSchema).max(MAX_ENTRIES),
        z
            .record(z.string().max(200), triggerValueSchema)
            .refine((entries) => Object.keys(entries).length <= MAX_ENTRIES),
    ]),
)

/** The subject a node's effect touched, as a step result keeps it. */
interface StoredSubject {
    /** The kind of record. */
    readonly kind: string
    /** Its id. */
    readonly id: string
}

/** The result a done node step keeps: the effects it ran, to undo them when the run fails before a pivot. */
interface DoneResult {
    /** The effects it ran, in order. */
    readonly effects: ReadonlyArray<{ readonly id: string; readonly subject: StoredSubject }>
}

/** The tool call a person was asked to approve, as the approval item keeps it. */
interface AskedItem {
    /** The fields of the item. */
    readonly fields: AskedFields
}

/** The fields of an approval item that name the exact call. */
interface AskedFields {
    /** The fingerprint of the tool and its arguments. */
    readonly fingerprint: string
}

/** The effects a done node step ran, as its result keeps them. */
export const doneSchema: z.ZodType<DoneResult> = z.object({
    effects: z
        .array(
            z.object({
                id: z.string().max(200),
                subject: z.object({ kind: z.string().max(200), id: z.string().max(200) }),
            }),
        )
        .max(MAX_ENTRIES),
})

/** The subject a trigger names. */
export const subjectSchema: z.ZodType<StoredSubject> = z.object({
    kind: z.string().min(1).max(200),
    id: z.string().min(1).max(200),
})

const approvalSchema: z.ZodType<GraphNodeApproval> = z.object({
    stepKey: z.string().min(1).max(200),
    by: z.string().min(1).max(200),
    fingerprint: z.string().min(1).max(200),
})

/** What a graph node step carries in its row. */
export const stepInputSchema: z.ZodType<GraphNodeStepInput> = z.object({
    versionId: z.string().min(1).max(200),
    nodeKey: z.string().min(1).max(200),
    trigger: z
        .record(z.string().max(200), triggerValueSchema)
        .refine((entries) => Object.keys(entries).length <= MAX_ENTRIES),
    approval: approvalSchema.optional(),
})

/** The tool call a node asked a person to approve, as the approval item keeps it. */
export const askedSchema: z.ZodType<AskedItem> = z.object({
    fields: z.object({ fingerprint: z.string().min(1).max(200) }),
})
