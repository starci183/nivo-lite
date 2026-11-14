import { z } from "zod"

/** The longest customer text a step reads (one burst of messages, or a mail's summary). */
export const TEXT_MAX = 8000

/** The longest one-line summary or diagnosis line a step writes. */
export const LINE_MAX = 600

/** The longest id or code (a conversation id, a customer code, a ticket id). */
export const ID_MAX = 100

/** The most service codes a step hands on for one ticket. */
export const SERVICES_MAX = 20

/** The longest text the team post carries (the post's own most). */
export const POST_MAX = 4000

/** The longest note on a ticket (the CRM's own most). */
export const NOTE_MAX = 1000

/** The language the team reads. */
export type TeamLocale = "vi" | "en"

/** The schema of the team's language. */
export const localeSchema: z.ZodType<TeamLocale, TeamLocale> = z.enum(["vi", "en"])

/** An id, a code or nothing. */
export const optionalId: z.ZodType<string | null | undefined> = z.string().min(1).max(ID_MAX).nullish()

/** The `cannot` reason of a step after the intake that is given no ticket. */
export const TICKET_MISSING = "ticket_missing"

/**
 * The ticket a step after the intake works on, as the intake answered it. Null only when a person declined the intake's write: the graph
 * routes that run to the team's notice and the `declined` outcome BEFORE this step, but a graph's refs are not narrowed by an `ifNode`
 * (strict nullability judges the source's type), so the member admits null (left out reads as null) and the step refuses it (`cannot`,
 * `TICKET_MISSING`).
 */
export const intakeTicketId: z.ZodDefault<z.ZodNullable<z.ZodString>> = z
    .string()
    .min(1)
    .max(ID_MAX)
    .nullable()
    .default(null)

/** A text, or nothing. */
export const optionalLine: z.ZodType<string | null | undefined> = z.string().max(TEXT_MAX).nullish()

/** A zod type of a step's input or output as the node declares it: the parsed type and, when it differs, the type a graph binds. */
export type NodeSchema<Out, In = Out> = z.ZodType<Out, In>

/** An id or a code a step reads, or nothing: a member left out where the step is bound reads as null. */
export const nullableId: z.ZodDefault<z.ZodNullable<z.ZodString>> = z
    .string()
    .min(1)
    .max(ID_MAX)
    .nullable()
    .default(null)

/** A text a step reads, or nothing: a member left out where the step is bound reads as null. */
export const nullableLine: z.ZodDefault<z.ZodNullable<z.ZodString>> = z.string().max(TEXT_MAX).nullable().default(null)

/**
 * A step's input as a graph binds it: the members `K` (each `nullableId` / `nullableLine`, so `T[K]` holds null) may be left out. The
 * parsed input `T` is a type alias, never an interface, so it is the `JsonValue` that `agent.run` takes as `input`.
 */
export type Given<T, K extends keyof T> = Omit<T, K> & { readonly [M in K]?: T[M] | undefined }

/** The service codes a ticket is about. */
export const serviceCodesSchema: z.ZodType<ReadonlyArray<string>, ReadonlyArray<string>> = z
    .array(z.string().min(1).max(ID_MAX))
    .max(SERVICES_MAX)
    .describe(
        "The codes of the customer's services this request is about, as the CRM answered them; empty when none is known.",
    )

/** What a ticket is about, as the CRM's document lists the kinds. */
export type TicketKind = "fault" | "complaint" | "question" | "request"

/** Where a request came in, as the CRM's document lists the channels. */
export type TicketChannel = "zalo" | "email" | "phone" | "chat"

/** The state a ticket is set to once its first turn is planned: a person is on it, or a quote waits for the customer. */
export type PlannedStatus = "in_progress" | "quoted"

/** The schema of a ticket's kind, described for the model. */
export const ticketKindSchema: z.ZodType<TicketKind> = z
    .enum(["fault", "complaint", "question", "request"])
    .describe("What the request is: a fault, a complaint, a question or a request.")

/** The schema of a request's channel. */
export const ticketChannelSchema: z.ZodType<TicketChannel> = z.enum(["zalo", "email", "phone", "chat"])

/** One message for the team: a short title and the text. */
export type TeamNotice = {
    /** A short title with the ticket id. */
    readonly title: string
    /** The text, in the team's language. */
    readonly text: string
}

/** The schema of one message for the team, described for the model. */
export const teamNoticeSchema: z.ZodType<TeamNotice> = z.object({
    title: z.string().min(1).max(200).describe("A short title naming the ticket id."),
    text: z.string().min(1).max(POST_MAX).describe("The text, in the team's language (`locale`)."),
})

/**
 * A ticket opened (or found open) for a request, with the customer it belongs to; or, when a person declined the step's write, no
 * ticket (`declined` true, `ticketId` null): their decision, which the graph routes to the team's notice and the `declined` outcome.
 */
export interface OpenedTicket {
    /** The ticket's id, as the CRM answered it; null only when a person declined the write. */
    readonly ticketId: string | null
    /** True when a person declined the ticket's write (DECLINED rule 1): nothing was written. */
    readonly declined: boolean
    /** The customer's code in the CRM, or null when nobody was identified. */
    readonly customerCode: string | null
    /** The services the request is about. */
    readonly serviceCodes: ReadonlyArray<string>
    /** One line in the team's language: what the customer reports. */
    readonly summary: string
}

/** The schema of an opened ticket (a step's output: the code fills it from the CRM's answer and the agent's lines). */
export const openedTicketSchema: z.ZodType<OpenedTicket> = z.object({
    ticketId: z.string().min(1).max(ID_MAX).nullable(),
    declined: z.boolean(),
    customerCode: z.string().min(1).max(ID_MAX).nullable(),
    serviceCodes: serviceCodesSchema,
    summary: z.string().min(1).max(LINE_MAX),
})

/** What the check found, before anyone answers the customer. */
export interface CheckedTicket {
    /** The ticket. */
    readonly ticketId: string
    /** What the system shows and what is most likely wrong, in the team's language. */
    readonly diagnosis: string
    /** True when the company's truths put the request inside what the customer's contract or warranty already covers. */
    readonly covered: boolean
    /** The truths and passages the decision on `covered` rests on, named (title or id, and date). */
    readonly basis: string
}

/** The schema of a checked ticket, every member described for the model. */
export const checkedTicketSchema: z.ZodType<CheckedTicket> = z.object({
    ticketId: z.string().min(1).max(ID_MAX).describe("The `ticketId` you were given."),
    diagnosis: z
        .string()
        .min(1)
        .max(LINE_MAX)
        .describe(
            "What the system shows (state of each service checked) and what is most likely wrong, in the team's language.",
        ),
    covered: z
        .boolean()
        .describe(
            "True when the company's truths put this request inside the customer's contract or warranty (no charge); false when it is extra work to quote.",
        ),
    basis: z
        .string()
        .min(1)
        .max(LINE_MAX)
        .describe(
            "The truths or document passages `covered` rests on, each named (title or id, and date); say plainly when none was found.",
        ),
})

/** The state a planned ticket is set to: plain logic on the check's `covered`, never the model's. */
export const plannedStatusOf = (covered: boolean): PlannedStatus => (covered ? "in_progress" : "quoted")
