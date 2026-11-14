import { z } from "zod"

/** The most services one round handles: the loop's own most (contract C1 cap 50), and the CRM list's page. */
export const ROUND_SERVICES_MAX = 50

/** The most services one customer's answer names. */
export const ANSWER_SERVICES_MAX = 20

/** The longest line a step writes for the team or as a summary. */
export const LINE_MAX = 400

/** The longest customer message a step answers with. */
export const REPLY_MAX = 2000

/** The longest id a tool answers (a reminder, a message, a renewal request, a provider key). */
export const ID_MAX = 100

/** The language the team reads. */
export type TeamLocale = "vi" | "en"

/** The schema of the team's language. */
export const localeSchema: z.ZodType<TeamLocale> = z.enum(["vi", "en"])

/** Where a service's end date came from, as the CRM says it. */
export type ExpirySource = "provider" | "estimated" | "invoice" | "confirmed" | "none"

/** Why a service the rules would remind today is not reminded now. */
export type HeldWhy =
    | "unreachable"
    | "expiry_unknown"
    | "estimated"
    | "open_reminder"
    | "open_renewal"
    | "outside_hours"
    | "stop_and_tell"

/** One service the renewal rules say to remind today, as the round hands it to the reminder steps. */
export type DueService = {
    /** The service code. */
    readonly serviceCode: string
    /** The customer it belongs to. */
    readonly customerCode: string
    /** hosting, domain or ssl. */
    readonly serviceClass: string
    /** The website's domain, when known. */
    readonly domain: string | null
    /** The end date, `YYYY-MM-DD`. */
    readonly expiresOn: string | null
    /** Where the end date came from. */
    readonly expirySource: ExpirySource
    /** The last reminder's day, when there was one. */
    readonly lastReminderOn: string | null
    /** How many reminders were recorded. */
    readonly reminderCount: number
}

/** One service the rules would remind but the round holds, with why. */
export type HeldService = {
    /** The service code. */
    readonly serviceCode: string
    /** The customer. */
    readonly customerCode: string
    /** Why it is held. */
    readonly why: HeldWhy
}

/**
 * What a reminder record step recorded for one service (`webrenew.remind-record`, `quote-record`, `close-record`): the output the
 * loops collect. The channel is the one the send's own facts named (`value.channel` of the lead send: `zalo`, `telegram`, ...;
 * `email` for a mail), never a channel the node typed. A reminder that did not go out never reaches the record: its loop item's
 * output is null. A record a person declined is a decision: `declined` true, no reminder id.
 */
export type SentReminder = {
    /** The service reminded. */
    readonly serviceCode: string
    /** The channel the reminder went through, as the send answered it. */
    readonly channel: string | null
    /** True when a person declined the record (a shop's own `ask`): nothing was recorded. */
    readonly declined: boolean
    /** The id of the reminder the CRM recorded; null when a person declined the record. */
    readonly reminderId: string | null
}

/**
 * One item of a loop's output (contract C4 replay (4)): the item's key and the collected node's output, null when not reached.
 */
export type LoopItem<T> = {
    /** The item's key: the declared member of the item, or its index. */
    readonly key: string
    /** The `collect` node's output for the item, or null when the item's branch did not reach it. */
    readonly output: T | null
}

/** A loop's output (contract C4 replay (4)): every item, and the items held past the cap of 50. */
export type LoopOutput<T> = {
    /** Every item the loop ran, in order. */
    readonly items: ReadonlyArray<LoopItem<T>>
    /** The items past the cap, not run: how many, and the first one's key; null when none. */
    readonly held: { readonly count: number; readonly firstKey: string } | null
}

/** The schema of a loop's output whose collected node outputs `output`. */
export const loopOutputSchema = <T>(output: z.ZodType<T>): z.ZodType<LoopOutput<T>> =>
    z.object({
        items: z
            .array(z.object({ key: z.string().min(1).max(ID_MAX), output: output.nullable() }))
            .max(ROUND_SERVICES_MAX),
        held: z.object({ count: z.number().int().positive(), firstKey: z.string().min(1).max(ID_MAX) }).nullable(),
    })

const code = z.string().min(1).max(120)
const customer = z.string().min(1).max(80)
const day = z.string().max(10)

const dueObject = z.object({
    serviceCode: code.describe("The service's `code` as the list answered it."),
    customerCode: customer.describe("The service's `customerCode` as the list answered it."),
    serviceClass: z.string().min(1).max(20).describe("The `serviceClass` as the list answered it."),
    domain: z.string().max(253).nullable().describe("The `domain` as the list answered it."),
    expiresOn: day.nullable().describe("The `expiresOn` as the list answered it."),
    expirySource: z
        .enum(["provider", "estimated", "invoice", "confirmed", "none"])
        .describe("The `expirySource` as the list answered it."),
    lastReminderOn: day.nullable().describe("The `lastReminderOn` as the list answered it."),
    reminderCount: z.number().int().nonnegative().describe("The `reminderCount` as the list answered it."),
})

/** The schema of one due service, every member described for the model. */
export const dueServiceSchema: z.ZodType<DueService> = dueObject

/** One due service and the language the reminder is written in: what the reminder's send step takes. */
export type DueServiceInput = DueService & {
    /** The language the team reads. */
    readonly locale: TeamLocale
}

/** The schema of the reminder's send step input. */
export const dueServiceInputSchema: z.ZodType<DueServiceInput> = dueObject.extend({ locale: z.enum(["vi", "en"]) })

/** The schema of one held service. */
export const heldServiceSchema: z.ZodType<HeldService> = z.object({
    serviceCode: code.describe("The service's `code`."),
    customerCode: customer.describe("The service's `customerCode`."),
    why: z
        .enum([
            "unreachable",
            "expiry_unknown",
            "estimated",
            "open_reminder",
            "open_renewal",
            "outside_hours",
            "stop_and_tell",
        ])
        .describe(
            "unreachable: no contact known; expiry_unknown: no end date; estimated: the end date is an estimate a person must check; open_reminder: the last reminder still waits for an answer; open_renewal: a renewal request is open; outside_hours: the support hours say not to send now; stop_and_tell: the rules say to stop reminding and tell the team.",
        ),
})

/** The schema of a channel as a send's facts name it (`zalo`, `telegram`, `website`, ...; `email` for a mail), or null. */
export const channelSchema: z.ZodType<string | null> = z.string().min(1).max(ID_MAX).nullable()

/** The schema of one recorded reminder. */
export const sentReminderSchema: z.ZodType<SentReminder> = z.object({
    serviceCode: code,
    channel: channelSchema,
    declined: z.boolean(),
    reminderId: z.string().min(1).max(ID_MAX).nullable(),
})
