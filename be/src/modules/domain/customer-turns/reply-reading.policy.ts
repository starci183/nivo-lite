import type { ChatBookingIntent, ChatBookingRequest } from "@modules/domain/work-performers"
import type {
    CapturedLead,
    ChatApplicationProposal,
    CapturedOrder,
    CustomerReply,
    HumanReason,
    NamedGap,
    ReplyFindings,
} from "./customer-turns.contracts"

/** A JSON object whose members are not known yet. */
type Loose = Readonly<Record<string, unknown>>

const NAME_MAX = 120
const NEED_MAX = 600
const PHONE_MAX = 40
const QUESTION_MAX = 300
const TOPIC_MAX = 160
const REWARD_MAX = 40
const REPLY_MAX = 20_000
const PROPOSED_RAW_MAX = 1500
const JOB_MAX = 100
const APPLICANT_PHONE_MAX = 30
const EMAIL_MAX = 254
const AVAILABILITY_MAX = 300
const QUESTION_ID_MAX = 24
const ANSWER_MAX = 1000
const SERVICE_MAX = 160
const BOOKING_NOTE_MAX = 400
const PARTY_MAX = 200
const BOOKING_INTENTS: ReadonlyArray<ChatBookingIntent> = ["book", "reschedule", "cancel", "availability", "waitlist"]
const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/u
const YMD = /^\d{4}-\d{2}-\d{2}$/u

const isLoose = (value: unknown): value is Loose => typeof value === "object" && value !== null && !Array.isArray(value)

const textOf = (value: unknown, max: number): string => (typeof value === "string" ? value.trim().slice(0, max) : "")

/** A parse attempt: the value, or the failure that stopped it. */
interface Parsed {
    /** The parsed value; null when the text is not JSON. */
    readonly value: unknown
    /** The parse failure, when there was one. */
    readonly cause?: unknown
}

const parseJson = (text: string): Parsed => {
    try {
        return { value: JSON.parse(text) }
    } catch (cause) {
        return { value: null, cause }
    }
}

const tryObject = (text: string): Loose | null => {
    const { value } = parseJson(text)
    return isLoose(value) ? value : null
}

/** The JSON object in a model answer: the whole text, a fenced block, or the outermost braces; null when there is none. */
export const parseJsonLoose = (raw: string): Loose | null => {
    const unfenced = raw.replace(/^```(?:json)?\s*/iu, "")
    const body = (unfenced.endsWith("```") ? unfenced.slice(0, -3) : unfenced).trim()
    const whole = tryObject(body)
    if (whole !== null) return whole
    const start = body.indexOf("{")
    const end = body.lastIndexOf("}")
    return start >= 0 && end > start ? tryObject(body.slice(start, end + 1)) : null
}

const leadOf = (value: unknown): CapturedLead | null => {
    if (!isLoose(value)) return null
    const contactName = textOf(value.contact_name, NAME_MAX)
    const need = textOf(value.need, NEED_MAX)
    if (contactName === "" || need === "") return null
    return {
        contactName,
        company: textOf(value.company, NAME_MAX),
        need,
        phone: textOf(value.phone, PHONE_MAX) || null,
        email: textOf(value.email, NAME_MAX) || null,
    }
}

const amountOf = (value: unknown): number => {
    if (typeof value === "number") return value
    if (typeof value === "string") return Number(value.replace(/[^\d]/gu, ""))
    return Number.NaN
}

const orderOf = (value: unknown): CapturedOrder | null => {
    if (!isLoose(value)) return null
    const items = textOf(value.items, NEED_MAX)
    const amount = amountOf(value.amount_vnd)
    if (items === "" || !Number.isFinite(amount) || amount <= 0) return null
    return { items, amountVnd: Math.round(amount) }
}

const gapOf = (value: unknown): NamedGap | null => {
    if (!isLoose(value)) return null
    const question = textOf(value.question, QUESTION_MAX)
    return question === "" ? null : { question, topic: textOf(value.topic, TOPIC_MAX) }
}

const answersOf = (value: unknown): ChatApplicationProposal["answers"] =>
    (Array.isArray(value) ? value : []).flatMap((entry: unknown) => {
        if (!isLoose(entry)) return []
        const questionId = textOf(entry.question_id, QUESTION_ID_MAX)
        const answer = textOf(entry.answer, ANSWER_MAX)
        return questionId !== "" && answer !== "" ? [{ questionId, answer }] : []
    })

/** A job application the chat captured: a job, a name, a phone or an email, and the applicant's clear consent; anything less is none. */
export const readChatApplication = (value: unknown): ChatApplicationProposal | null => {
    if (!isLoose(value)) return null
    const job = textOf(value.job, JOB_MAX)
    const name = textOf(value.name, NAME_MAX)
    const phone = textOf(value.phone, APPLICANT_PHONE_MAX)
    const email = textOf(value.email, EMAIL_MAX)
    if (job === "" || name === "" || (phone === "" && email === "") || value.consent !== true) return null
    return {
        job,
        name,
        phone,
        email,
        consent: true,
        availability: textOf(value.availability, AVAILABILITY_MAX),
        answers: answersOf(value.answers),
    }
}

const hhmmOf = (value: unknown): string | null => {
    const text = textOf(value, 5)
    return HHMM.test(text) ? text.padStart(5, "0") : null
}

const ymdOf = (value: unknown): string | null => {
    const text = textOf(value, 10)
    return YMD.test(text) ? text : null
}

const intentOf = (value: unknown): ChatBookingIntent | null =>
    BOOKING_INTENTS.find((intent) => intent === value) ?? null

const orNull = (text: string): string | null => (text === "" ? null : text)

/** The appointment request of a reply ("booking_request"): an intent the contract names, every other member read and bounded. */
export const readChatBookingRequest = (value: unknown): ChatBookingRequest | null => {
    if (!isLoose(value)) return null
    const intent = intentOf(value.intent)
    if (intent === null) return null
    const party = Number(value.party_size)
    return {
        intent,
        service: textOf(value.service, SERVICE_MAX),
        date: ymdOf(value.date),
        time: hhmmOf(value.time),
        from: hhmmOf(value.from),
        to: hhmmOf(value.to),
        partySize: Number.isFinite(party) && party >= 1 ? Math.min(PARTY_MAX, Math.round(party)) : 1,
        name: textOf(value.contact_name, NAME_MAX),
        phone: orNull(textOf(value.phone, PHONE_MAX)),
        email: orNull(textOf(value.email, EMAIL_MAX)),
        note: orNull(textOf(value.note, BOOKING_NOTE_MAX)),
    }
}

const rewardOf = (value: unknown): string | null => {
    if (!isLoose(value) || value.intent !== "redeem") return null
    return textOf(value.reward_key, REWARD_MAX) || null
}

const reasonOf = (value: unknown, needsHuman: boolean): HumanReason | null => {
    if (value === "over_authority" || value === "unclear_outcome") return value
    return needsHuman ? "unclear_outcome" : null
}

/** The structured findings of a reply object; anything malformed reads as absent. */
export const findingsOf = (value: Loose): ReplyFindings => ({
    lead: leadOf(value.lead),
    order: orderOf(value.order),
    paymentClaim: value.payment_claim === true,
    knowledgeGap: gapOf(value.knowledge_gap),
    application: readChatApplication(value.application),
    loyaltyRewardKey: rewardOf(value.loyalty),
    bookingRequest: readChatBookingRequest(value.booking_request),
})

/**
 * Reads a model answer as the reply contract. An answer that is not the JSON object (a model that ignored the contract) is never sent
 * as it is: it becomes an answer for a person to approve, and the customer gets the holding line.
 */
export const readCustomerReply = (raw: string, holdingLine: string): CustomerReply => {
    const parsed = parseJsonLoose(raw)
    const reply = parsed === null ? "" : textOf(parsed.reply, REPLY_MAX)
    if (parsed === null || reply === "") {
        return {
            reply: holdingLine,
            needsHuman: true,
            reason: "unclear_outcome",
            proposedAnswer: raw.trim().slice(0, PROPOSED_RAW_MAX) || null,
            lead: null,
            order: null,
            paymentClaim: false,
            knowledgeGap: null,
            application: null,
            loyaltyRewardKey: null,
            bookingRequest: null,
        }
    }
    const needsHuman = parsed.needs_human === true
    return {
        reply,
        needsHuman,
        reason: reasonOf(parsed.reason, needsHuman),
        proposedAnswer: textOf(parsed.proposed_answer, REPLY_MAX) || null,
        ...findingsOf(parsed),
    }
}

/** The findings as the opaque detail of a proposal, in the reply contract's own member names. */
export const detailOf = (reply: CustomerReply): Readonly<Record<string, unknown>> => ({
    lead:
        reply.lead === null
            ? null
            : {
                  contact_name: reply.lead.contactName,
                  company: reply.lead.company,
                  need: reply.lead.need,
                  phone: reply.lead.phone,
                  email: reply.lead.email,
              },
    order: reply.order === null ? null : { items: reply.order.items, amount_vnd: reply.order.amountVnd },
    payment_claim: reply.paymentClaim,
    knowledge_gap: reply.knowledgeGap,
    application:
        reply.application === null
            ? null
            : {
                  ...reply.application,
                  answers: reply.application.answers.map((entry) => ({
                      question_id: entry.questionId,
                      answer: entry.answer,
                  })),
              },
    loyalty: reply.loyaltyRewardKey === null ? null : { intent: "redeem", reward_key: reply.loyaltyRewardKey },
    booking_request:
        reply.bookingRequest === null
            ? null
            : {
                  intent: reply.bookingRequest.intent,
                  service: reply.bookingRequest.service,
                  date: reply.bookingRequest.date,
                  time: reply.bookingRequest.time,
                  from: reply.bookingRequest.from,
                  to: reply.bookingRequest.to,
                  party_size: reply.bookingRequest.partySize,
                  contact_name: reply.bookingRequest.name,
                  phone: reply.bookingRequest.phone,
                  email: reply.bookingRequest.email,
                  note: reply.bookingRequest.note,
              },
})

/** The reason a proposal names, read back. */
export const humanReasonOf = (reason: string, needsHuman: boolean): HumanReason | null => reasonOf(reason, needsHuman)
