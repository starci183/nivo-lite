import { z } from "zod"

/** The longest customer reply the schema takes; the check `reply_bounded` holds a tighter line. */
export const REPLY_SCHEMA_MAX = 4000

const NAME_MAX = 120
const NEED_MAX = 600
const PHONE_MAX = 40
const EMAIL_MAX = 254
const QUESTION_MAX = 300
const TOPIC_MAX = 160
const REWARD_MAX = 40
const JOB_MAX = 100
const SERVICE_MAX = 160
const NOTE_MAX = 400
const SLOT_MAX = 10
const PARTY_MAX = 200
const ANSWER_MAX = 1000
const ANSWERS_MAX = 40
const ID_MAX = 80
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

const nameText = z.string().trim().max(NAME_MAX)
const needText = z.string().trim().max(NEED_MAX)
const phoneText = z.string().trim().max(PHONE_MAX)
const emailText = z.string().trim().max(EMAIL_MAX)
const slotText = z.string().trim().max(SLOT_MAX)
const noteText = z.string().trim().max(NOTE_MAX)

const leadSchema = z.strictObject({
    contact_name: nameText,
    company: nameText.default(""),
    need: needText,
    phone: phoneText.nullable().default(null),
    email: emailText.nullable().default(null),
})

const orderSchema = z.strictObject({ items: needText, amount_vnd: z.number().int().min(0) })

const gapSchema = z.strictObject({
    question: z.string().trim().max(QUESTION_MAX),
    topic: z.string().trim().max(TOPIC_MAX).default(""),
})

const bookingSchema = z.strictObject({
    intent: z.enum(["book", "reschedule", "cancel", "availability", "waitlist"]),
    service: z.string().trim().max(SERVICE_MAX).default(""),
    date: slotText.nullable().default(null),
    time: slotText.nullable().default(null),
    from: slotText.nullable().default(null),
    to: slotText.nullable().default(null),
    party_size: z.number().int().min(1).max(PARTY_MAX).default(1),
    contact_name: nameText.default(""),
    phone: phoneText.nullable().default(null),
    email: emailText.nullable().default(null),
    note: noteText.nullable().default(null),
})

const loyaltySchema = z.strictObject({ intent: z.literal("redeem"), reward_key: z.string().trim().max(REWARD_MAX) })

const applicationSchema = z.strictObject({
    job: z.string().trim().max(JOB_MAX),
    name: nameText,
    phone: phoneText.default(""),
    email: emailText.default(""),
    consent: z.boolean(),
    availability: needText.default(""),
    answers: z
        .array(
            z.strictObject({
                question_id: z.string().trim().max(KEY_MAX),
                answer: z.string().trim().max(ANSWER_MAX),
            }),
        )
        .max(ANSWERS_MAX)
        .default([]),
})

const replyText = z.string().trim().max(REPLY_SCHEMA_MAX)

/** The result of a customer turn. Its members are the members of the reply contract of today, so the reader of the findings works on it. */
export const customerReplySchema = z.strictObject({
    reply: replyText,
    lead: leadSchema.nullable().default(null),
    needs_human: z.boolean().default(false),
    reason: z.enum(["over_authority", "unclear_outcome"]).nullable().default(null),
    proposed_answer: replyText.nullable().default(null),
    order: orderSchema.nullable().default(null),
    payment_claim: z.boolean().default(false),
    knowledge_gap: gapSchema.nullable().default(null),
    booking_request: bookingSchema.nullable().default(null),
    loyalty: loyaltySchema.nullable().default(null),
    application: applicationSchema.nullable().default(null),
})

const fieldValueSchema = z.union([z.string().max(FIELD_TEXT_MAX), z.number(), z.null()])

const taskSchema = z.strictObject({
    op: z.enum(["add", "done", "wait"]),
    key: z.string().trim().min(1).max(KEY_MAX),
    title: z.string().trim().max(TITLE_MAX).optional(),
    nextActionAt: z.iso.datetime({ offset: true }).max(TIME_MAX).optional(),
})

const subjectSchema = z.strictObject({
    type: z.enum([
        "lead",
        "order",
        "invoice",
        "transaction",
        "conversation",
        "inbound",
        "purchase_order",
        "stock",
        "video_project",
    ]),
    id: z.string().trim().min(1).max(ID_MAX),
})

/** The result of a tag turn: one request for the one intent that was picked, in the members of the internal contract of today. */
export const agentRequestSchema = z.strictObject({
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
export const ownTurnPickSchema = z.strictObject({})

/** What the answer of the model must be around the result: the intent, the result, whose shape the intent picks, and the gap. */
export const intentEnvelopeSchema = z.strictObject({
    intent: z.string().trim().min(1).max(KEY_MAX),
    result: z.looseObject({}).nullish(),
    gap: gapSchema.nullish(),
})
