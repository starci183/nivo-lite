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
const KEY_MAX = 100

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
