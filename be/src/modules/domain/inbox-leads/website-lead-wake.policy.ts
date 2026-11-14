/** What started the tag that wakes the owning agent of a website: the hosted form. The registry maps it to `website.message.received`. */
export const WEBSITE_LEAD_TAG_SOURCE = "website_lead"

/** The prefix of the key one accepted submission wakes under. */
const WAKE_KEY_PREFIX = "website-submission"

/** What the wake of one accepted submission carries. */
export interface WebsiteSubmissionFacts {
    /** The core contact the submission met. */
    readonly contactId: string
    /** The website site the form sat under (the entrance). */
    readonly siteId: string
    /** The input that stored the raw submission. */
    readonly inboundEventId: string
    /** The site's own id of the visitor (`visitor:<uuid>`, else `submission:<key>`): the identity the engine meets them by. */
    readonly visitorKey: string
    /** The name they gave, or null. */
    readonly name: string | null
    /** The phone, or null. */
    readonly phone: string | null
    /** The email, or null. */
    readonly email: string | null
    /** What they wrote, or null. */
    readonly request: string | null
    /** The page, the campaign and the device of the visit, the ones that say something. */
    readonly source: Readonly<Record<string, string>>
}

/**
 * The plain data the owning agent's graph reads as `trigger.*`: the contact the engine met (the subject of the run), the site, the stored
 * input, what the visitor wrote and the details they left. No conversation exists for a form, so the wake names none.
 */
export const websiteSubmissionPayloadOf = (facts: WebsiteSubmissionFacts): Readonly<Record<string, unknown>> => ({
    contactId: facts.contactId,
    siteId: facts.siteId,
    inboundEventId: facts.inboundEventId,
    request: facts.request,
    contact: { name: facts.name, phone: facts.phone, email: facts.email },
    source: facts.source,
})

/** The key one accepted submission wakes under: the form written twice, or retried after a failure, is one wake. */
export const websiteSubmissionEventKeyOf = (inboundEventId: string): string => `${WAKE_KEY_PREFIX}:${inboundEventId}`

/** The words a wake names its visitor by: the name, else the phone, else the email, else nothing. */
export const websiteSubmissionWhoOf = (facts: WebsiteSubmissionFacts): string =>
    facts.name ?? facts.phone ?? facts.email ?? ""
