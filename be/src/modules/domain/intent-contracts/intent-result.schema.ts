import { z } from "zod"

/** The longest customer reply the schema takes; the check `reply_bounded` holds a tighter line. */
export const REPLY_SCHEMA_MAX = 4000

const QUESTION_MAX = 300
const TOPIC_MAX = 160
const ID_MAX = 80
const TYPE_MAX = 40
const KEY_MAX = 100
const TITLE_MAX = 200
const ACTION_MAX = 80
const SUMMARY_MAX = 300
const REASON_MAX = 300
const INTERNAL_REPLY_MAX = 2000
const TASKS_MAX = 10
const FIELD_NAME_MAX = 60
const FIELD_TEXT_MAX = 2000
const FIELDS_MAX = 30
const TIME_MAX = 40

const gapSchema = z.strictObject({
    question: z.string().trim().max(QUESTION_MAX),
    topic: z.string().trim().max(TOPIC_MAX).default(""),
})

const fieldValueSchema = z.union([z.string().max(FIELD_TEXT_MAX), z.number(), z.null()])

const taskSchema = z.strictObject({
    op: z.enum(["add", "done", "wait"]),
    key: z.string().trim().min(1).max(KEY_MAX),
    title: z.string().trim().max(TITLE_MAX).optional(),
    nextActionAt: z.iso.datetime({ offset: true }).max(TIME_MAX).optional(),
})

const subjectSchema = z.strictObject({
    type: z.string().trim().min(1).max(TYPE_MAX),
    id: z.string().trim().min(1).max(ID_MAX),
})

/** The result of a tag turn: one request for the one intent that was picked, in the members of the internal contract of today. */
export const agentRequestSchema: z.ZodObject<
    {
        action: z.ZodString
        subject: z.ZodOptional<
            z.ZodObject<
                {
                    type: z.ZodString
                    id: z.ZodString
                },
                z.core.$strict
            >
        >
        leadId: z.ZodDefault<z.ZodNullable<z.ZodString>>
        fields: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodString, z.ZodNumber, z.ZodNull]>>>
        summary: z.ZodDefault<z.ZodString>
        reply: z.ZodDefault<z.ZodString>
        tasks: z.ZodDefault<
            z.ZodArray<
                z.ZodObject<
                    {
                        op: z.ZodEnum<{
                            add: "add"
                            done: "done"
                            wait: "wait"
                        }>
                        key: z.ZodString
                        title: z.ZodOptional<z.ZodString>
                        nextActionAt: z.ZodOptional<z.ZodISODateTime>
                    },
                    z.core.$strict
                >
            >
        >
        needsHuman: z.ZodDefault<z.ZodBoolean>
        reason: z.ZodDefault<z.ZodString>
    },
    z.core.$strict
> = z.strictObject({
    action: z.string().trim().min(1).max(ACTION_MAX),
    subject: subjectSchema.optional(),
    leadId: z.string().trim().max(ID_MAX).nullable().default(null),
    fields: z
        .record(z.string().max(FIELD_NAME_MAX), fieldValueSchema)
        .refine((fields) => Object.keys(fields).length <= FIELDS_MAX)
        .default({}),
    summary: z.string().trim().max(SUMMARY_MAX).default(""),
    reply: z.string().trim().max(INTERNAL_REPLY_MAX).default(""),
    tasks: z.array(taskSchema).max(TASKS_MAX).default([]),
    needsHuman: z.boolean().default(false),
    reason: z.string().trim().max(REASON_MAX).default(""),
})

/** The first answer of an intent that runs in a turn of its own: nothing but the intent. */
export const ownTurnPickSchema: z.ZodObject<{}, z.core.$strict> = z.strictObject({})

/** What the answer of the model must be around the result: the intent, the result, whose shape the intent picks, and the gap. */
export const intentEnvelopeSchema: z.ZodObject<
    {
        intent: z.ZodString
        result: z.ZodOptional<z.ZodNullable<z.ZodObject<{}, z.core.$loose>>>
        gap: z.ZodOptional<
            z.ZodNullable<
                z.ZodObject<
                    {
                        question: z.ZodString
                        topic: z.ZodDefault<z.ZodString>
                    },
                    z.core.$strict
                >
            >
        >
    },
    z.core.$strict
> = z.strictObject({
    intent: z.string().trim().min(1).max(KEY_MAX),
    result: z.looseObject({}).nullish(),
    gap: gapSchema.nullish(),
})
