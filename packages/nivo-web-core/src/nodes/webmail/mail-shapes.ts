import { z } from "zod"

/** The most mails one round takes from the list: the list tool's own most. */
export const ROUND_MAILS_MAX = 25

/** The most mails a report reads: the loop's own most, so a round's results always fit. */
export const REPORT_MAILS_MAX = 50

/** The language the team reads. */
export type TeamLocale = "vi" | "en"

/** One new mail as the round hands it on: its head and opening, copied from the list's answer. */
export type ListedMail = {
    /** The mail's id, as the list answered it. */
    readonly id: string
    /** The mailbox (connection id) it was read from. */
    readonly mailbox: string
    /** The sender: the address, else the name, else empty. */
    readonly from: string
    /** The subject. */
    readonly subject: string
    /** The opening, as the list cut it. */
    readonly snippet: string
    /** Whether it carries attachments (their content is never read). */
    readonly hasAttachments: boolean
}

/** The members of a listed mail's schema. */
export type ListedMailShape = {
    /** The schema of the mail's id. */
    id: z.ZodString
    /** The schema of the mailbox id. */
    mailbox: z.ZodString
    /** The schema of the sender. */
    from: z.ZodString
    /** The schema of the subject. */
    subject: z.ZodString
    /** The schema of the opening. */
    snippet: z.ZodString
    /** The schema of the attachments flag. */
    hasAttachments: z.ZodBoolean
}

/** The schema of one listed mail, every member described for the model. */
export const listedMailSchema: z.ZodObject<ListedMailShape> = z.object({
    id: z.string().min(1).max(100).describe("The mail's id, exactly as the list answered it."),
    mailbox: z.string().min(1).max(100).describe("The mailbox id the list answered for it."),
    from: z
        .string()
        .max(400)
        .describe(
            "The sender's address as the list answered it; the name when there is no address; empty when neither.",
        ),
    subject: z.string().max(400).describe("The subject, as the list answered it."),
    snippet: z.string().max(400).describe("The opening, as the list answered it."),
    hasAttachments: z.boolean().describe("As the list answered it."),
})

/** The schema of the team's language. */
export const localeSchema: z.ZodType<TeamLocale> = z.enum(["vi", "en"])

/** The longest summary of one mail: what the steps it is handed to read (`summary`, one line of at most 400). */
export const SUMMARY_MAX = 400

/**
 * What a mail is, as the sort step reads it (since `webmail.triage` v3): a customer's answer about a renewal, a support request,
 * a supplier's invoice or bill, someone asking to buy or for a price, another mail a person must handle, or a mail nobody needs
 * to act on.
 */
export type MailKind = "renewal-reply" | "ticket" | "supplier-invoice" | "enquiry" | "needs-person" | "other"

/** The kinds a mail of the round is handed on for, each to the agent that handles it. */
export type HandedKind = Exclude<MailKind, "needs-person" | "other">

/** One mail as the sort step (`webmail.sort`) answered it: its head, what kind of mail it is, and what it says. */
export type KindedMail = {
    /** The mail's id. */
    readonly mailId: string
    /** The mailbox it was read from. */
    readonly mailbox: string
    /** The sender. */
    readonly from: string
    /** The subject. */
    readonly subject: string
    /** What kind of mail it is, as the model read it. */
    readonly kind: MailKind
    /**
     * One short line in the team's language: what the mail says or asks, its facts as written, and why a person must act when one
     * must.
     */
    readonly summary: string
}

/** One mail as a hand-off passes it to the next agent's workflow: what that workflow's first step reads per mail. */
export type HandedMail = {
    /** The mail's id. */
    readonly mailId: string
    /** The mailbox it was read from. */
    readonly mailbox: string
    /** The sender. */
    readonly from: string
    /** The subject. */
    readonly subject: string
    /** What the mail says or asks, its facts as written. */
    readonly summary: string
}

/** The schema of what kind a mail is, each kind described for the model: the model reads the mail, no word decides it. */
export const mailKindSchema: z.ZodType<MailKind> = z
    .enum(["renewal-reply", "ticket", "supplier-invoice", "enquiry", "needs-person", "other"])
    .describe(
        "What this mail is, by what it means: " +
            '"renewal-reply" = a customer answers about renewing a service they hold (they renew, decline, ask to change it, or answer a reminder); ' +
            '"ticket" = a customer asks for help or reports a fault or a problem with a service they hold; ' +
            '"supplier-invoice" = a supplier of the company sends an invoice, a bill or a payment notice for what the company bought; ' +
            '"enquiry" = someone asks to buy something new from the company or asks for a price; ' +
            '"needs-person" = none of these, and a person of the team must still handle it (by your guidance and the truths); ' +
            '"other" = nobody needs to act on it.',
    )

/** The schema of one mail the sort step answered, every member described for the model. */
export const kindedMailSchema: z.ZodType<KindedMail> = z.object({
    mailId: z.string().min(1).max(100).describe("The `id` of the mail you were given."),
    mailbox: z.string().min(1).max(100).describe("The `mailbox` you were given."),
    from: z.string().max(400).describe("The `from` you were given."),
    subject: z.string().max(400).describe("The `subject` you were given."),
    kind: mailKindSchema,
    summary: z
        .string()
        .min(1)
        .max(SUMMARY_MAX)
        .describe(
            "One short line in the team's language: what the mail says or asks, with its facts exactly as written (a domain, an " +
                "invoice number, an amount, a date); for `needs-person`, also why a person must handle it.",
        ),
})

/** The schema of one mail a hand-off passes on. */
export const handedMailSchema: z.ZodType<HandedMail> = z.object({
    mailId: z.string().min(1).max(100),
    mailbox: z.string().min(1).max(100),
    from: z.string().max(400),
    subject: z.string().max(400),
    summary: z.string().min(1).max(SUMMARY_MAX),
})

/** One item of the round's loop as the engine collects it (contract C4 (4)): the mail's id, and the sort's answer or null. */
export type SortedItem = {
    /** The loop's item key: the mail's id. */
    readonly key: string
    /** What the sort step answered, or null when the item did not reach it. */
    readonly output: KindedMail | null
}

/** The mails the loop did not run because the round passed the loop's cap (contract C4 (5)); null when none was held. */
export type HeldItems = {
    /** How many mails were not run. */
    readonly count: number
    /** The key of the first one not run. */
    readonly firstKey: string
}

/** The schema of one collected item of the round's loop. */
export const sortedItemSchema: z.ZodType<SortedItem> = z.object({
    key: z.string().min(1).max(100),
    output: kindedMailSchema.nullable(),
})

/** The schema of the loop's held count. */
export const heldItemsSchema: z.ZodType<HeldItems> = z.object({
    count: z.number().int().min(1),
    firstKey: z.string().min(1).max(100),
})
