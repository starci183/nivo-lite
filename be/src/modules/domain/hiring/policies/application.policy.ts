import { HiringErrorCode } from "../errors/hiring.error"
import type { Answer, JobRecord } from "../hiring.contracts"
import { clip, EMAIL_MAX, isEmailAddress, normalizePhone } from "./text.policy"

/** What an applicant typed. */
export interface ApplicationInput {
    /** The name as typed. */
    readonly name: string
    /** The phone as typed; may be empty when an email is given. */
    readonly phone: string
    /** The email as typed; may be empty when a phone is given. */
    readonly email: string
    /** The days and hours the applicant can work. */
    readonly availability: string
    /** Whether the applicant agreed that the business stores the application. */
    readonly consent: boolean
    /** The answers by question id. */
    readonly answers: ReadonlyArray<{ readonly questionId: string; readonly answer: string }>
}

/** An application once checked and cleaned. */
export interface CleanApplication {
    /** The name with spaces squeezed. */
    readonly name: string
    /** The phone as digits with a leading zero, or empty. */
    readonly phone: string
    /** The email in lower case, or empty. */
    readonly email: string
    /** The availability cut to length. */
    readonly availability: string
    /** The answers kept, in the order of the questions, with the question text at the time. */
    readonly answers: ReadonlyArray<Answer>
}

/** A refusal: the code and the values its sentence names. */
export interface Refusal {
    /** The code of the refusal. */
    readonly code: HiringErrorCode
    /** The values the sentence of the code names. */
    readonly params: Readonly<Record<string, string | number>>
}

/** The verdict on an application: the cleaned application, or why not. */
export type ApplicationCheck =
    { readonly ok: true; readonly value: CleanApplication } | { readonly ok: false; readonly refusal: Refusal }

const NAME_MIN = 2
const NAME_MAX = 120
const ANSWER_MAX = 1000
const AVAILABILITY_MAX = 300
const QUESTION_QUOTE_MAX = 80

const refuse = (code: HiringErrorCode, params: Readonly<Record<string, string | number>> = {}): ApplicationCheck => ({
    ok: false,
    refusal: { code, params },
})

/** Whether a job takes applications at a moment: open, and not past its closing date. */
export const openingRefusal = (job: Pick<JobRecord, "status" | "closesAt">, now: Date): Refusal | null => {
    if (job.status !== "open") return { code: HiringErrorCode.JobNotOpen, params: {} }
    return job.closesAt !== null && Date.parse(job.closesAt) < now.getTime()
        ? { code: HiringErrorCode.JobExpired, params: {} }
        : null
}

/** The first required question that has no answer, or null. */
const missingAnswer = (job: Pick<JobRecord, "questions">, input: ApplicationInput): string | null => {
    const question = job.questions.find(
        (item) =>
            item.required &&
            clip(input.answers.find((answer) => answer.questionId === item.id)?.answer ?? "", ANSWER_MAX) === "",
    )
    return question === undefined ? null : question.text.slice(0, QUESTION_QUOTE_MAX)
}

/** Checks the contact details and the answers of an application and cleans them. The job must already be known to take applications. */
export const checkApplication = (job: Pick<JobRecord, "questions">, input: ApplicationInput): ApplicationCheck => {
    if (!input.consent) return refuse(HiringErrorCode.ConsentRequired)
    const name = input.name.replace(/\s+/gu, " ").trim()
    if (name.length < NAME_MIN || name.length > NAME_MAX) return refuse(HiringErrorCode.NameInvalid)
    const typedPhone = input.phone.trim()
    const phone = typedPhone === "" ? "" : normalizePhone(typedPhone)
    if (phone === null) return refuse(HiringErrorCode.PhoneInvalid)
    const email = input.email.trim().toLowerCase()
    if (email !== "" && (!isEmailAddress(email) || email.length > EMAIL_MAX))
        return refuse(HiringErrorCode.EmailInvalid)
    if (phone === "" && email === "") return refuse(HiringErrorCode.ContactRequired)
    const missing = missingAnswer(job, input)
    if (missing !== null) return refuse(HiringErrorCode.AnswerRequired, { question: missing })
    const answers = job.questions.flatMap((question): Array<Answer> => {
        const given = clip(input.answers.find((answer) => answer.questionId === question.id)?.answer ?? "", ANSWER_MAX)
        return given === "" ? [] : [{ questionId: question.id, question: question.text, answer: given }]
    })
    return {
        ok: true,
        value: { name, phone, email, availability: clip(input.availability, AVAILABILITY_MAX), answers },
    }
}
