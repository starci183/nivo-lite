import { z } from "zod"
import { ANSWER_SERVICES_MAX, LINE_MAX, REPLY_MAX, type TeamLocale } from "./renew-shapes"

/** The routes of a customer's answer: agrees to renew, says they paid, declines, or asks something. */
export type AnswerBranch = "agree" | "paid" | "no" | "ask"

/** The route names, in the order the graph wires them (`routes.names` of `webrenew.understand-open`). */
export const ANSWER_BRANCHES: readonly [AnswerBranch, ...Array<AnswerBranch>] = ["agree", "paid", "no", "ask"]

/** What the customer's answer means, as the understand step answers it. */
export type UnderstoodAnswer = {
    /** The route. */
    readonly branch: AnswerBranch
    /**
     * The customer in the CRM, as the customer read answered it (code, never the model); null when the conversation is not
     * linked.
     */
    readonly customerCode: string | null
    /** The services the answer is about. */
    readonly serviceCodes: ReadonlyArray<string>
    /** The term the customer said, in months, when they said one. */
    readonly termMonths: number | null
    /** The open renewal request the answer is about, when there is one. */
    readonly renewalId: string | null
    /** One line for the team: what the customer said and means. */
    readonly summary: string
    /**
     * The customer's message the answer was read from, as the step was given it (the one-run talk, v14 of `webrenew.answer`: the
     * steps after the talk read the message of the round that ended it from here, a fact the step was handed, never the model's).
     */
    readonly text: string
}

/** Where the answer came from: the conversation and the NIVO customer, when known, and the team's language. */
export type AnswerSource = {
    /** The conversation, when the answer came in one. */
    readonly conversationId: string | null
    /** The NIVO customer (lead), when known. */
    readonly contactId: string | null
    /** The language the team reads. */
    readonly locale: TeamLocale
}

/** The schema of a nullable id passed on from a trigger. */
export const optionalId: z.ZodType<string | null> = z.string().min(1).max(100).nullable()

/** The schema of a nullable customer code. */
export const optionalCustomer: z.ZodType<string | null> = z.string().min(1).max(80).nullable()

/** The schema of the services an answer names. */
export const serviceCodesSchema: z.ZodType<ReadonlyArray<string>> = z
    .array(z.string().min(1).max(120))
    .max(ANSWER_SERVICES_MAX)

/** The schema of a nullable term in months. */
export const optionalTerm: z.ZodType<number | null> = z.number().int().min(1).max(120).nullable()

/** The schema of one line for the team. */
export const lineSchema: z.ZodType<string> = z.string().min(1).max(LINE_MAX)

/** The schema of a whole understood answer (the node's output). */
export const understoodSchema: z.ZodType<UnderstoodAnswer> = z.object({
    branch: z.enum(["agree", "paid", "no", "ask"]),
    customerCode: optionalCustomer,
    serviceCodes: serviceCodesSchema,
    termMonths: optionalTerm,
    renewalId: z.uuid().nullable(),
    summary: lineSchema,
    text: z.string().min(1).max(REPLY_MAX),
})
