import { z } from "zod"
import { maskPhones } from "@modules/platform/primitives"

/** The longest reply a tag or background turn keeps. */
export const REPLY_MAX = 2000
/** The most task changes one proposal keeps; the rest are cut. */
export const TASKS_MAX = 10
/** The most actions one proposal keeps; the rest are cut. */
export const ACTIONS_MAX = 3

const KEY_MAX = 100
const TITLE_MAX = 200
const ACTION_MAX = 80
const SUMMARY_MAX = 300
const REASON_MAX = 300
const FIELD_NAME_MAX = 60
const FIELD_TEXT_MAX = 2000
const FIELDS_MAX = 30
const TIME_MAX = 40

/** The id of a record: a uuid, because the columns it reaches are. A name or a handle the model made up is no id. */
const recordIdSchema = z.uuid()

const subjectTypeSchema = z.enum([
    "lead",
    "order",
    "invoice",
    "transaction",
    "conversation",
    "inbound",
    "purchase_order",
    "stock",
    "video_project",
])

const fieldValueSchema = z.union([
    z.string().max(FIELD_TEXT_MAX),
    z.number(),
    z.null(),
    z.boolean().transform((flag) => (flag ? "true" : "false")),
])

const taskSchema = z.strictObject({
    op: z.enum(["add", "done", "wait"]),
    key: z.string().trim().min(1).max(KEY_MAX),
    // A customer phone number does not belong in a title anyone on the desk reads: it is masked as the title is taken in.
    title: z.string().trim().max(TITLE_MAX).transform(maskPhones).optional(),
    nextActionAt: z.iso.datetime({ offset: true }).max(TIME_MAX).optional(),
})

/** The ids of an action, read on their own: an action that fails here is refused alone, and the rest of the proposal stands. */
export const actionIdsSchema = z.looseObject({
    subject: z.looseObject({ id: recordIdSchema }).optional(),
    leadId: recordIdSchema.nullish(),
})

const actionSchema = z.strictObject({
    action: z.string().trim().min(1).max(ACTION_MAX),
    subject: z.strictObject({ type: subjectTypeSchema, id: recordIdSchema }).optional(),
    leadId: recordIdSchema.nullish(),
    fields: z
        .record(z.string().max(FIELD_NAME_MAX), fieldValueSchema)
        .refine((fields) => Object.keys(fields).length <= FIELDS_MAX)
        .default({}),
    summary: z.string().trim().max(SUMMARY_MAX).transform(maskPhones).default(""),
})

/** What a tag or background turn may answer; a list over its bound is cut before this reads it. */
export const internalProposalSchema = z.strictObject({
    reply: z.string().max(REPLY_MAX).default(""),
    tasks: z.array(taskSchema).max(TASKS_MAX).default([]),
    actions: z.array(actionSchema).max(ACTIONS_MAX).default([]),
    needsHuman: z.boolean().default(false),
    reason: z.string().trim().max(REASON_MAX).default(""),
})
