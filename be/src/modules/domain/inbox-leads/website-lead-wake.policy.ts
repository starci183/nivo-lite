/** What started the tag that wakes the agent of a website: the hosted form. A graph's tag trigger sees it as `trigger.source`. */
export const WEBSITE_LEAD_TAG_SOURCE = "website_lead"

/** The module key of the department that receives a website customer when the owner picked no agent. */
export const WEBSITE_DEFAULT_MODULE = "sales"

/** The channel a website customer is on until a real one is linked: the form, which cannot be answered in. */
export const WEBSITE_LEAD_CHANNEL = "website"

/** The kind of the tag payload, so a node tells it from the payload of any other tag. */
export const WEBSITE_LEAD_KIND = "website-lead"

/** A way to reach a phone number unprompted that a connection of the workspace can carry. */
export type OutboundRoute = "zns" | "sms"

/**
 * How the first contact goes: a Zalo ZNS message or an SMS when a connection carries it, otherwise an item for the owner to call and confirm.
 * There is no other route, and none is ever named that the workspace does not have.
 */
export type FirstContactRoute = OutboundRoute | "owner_item"

/** How the customer can be reached at all: by the phone they gave, only by email, or not yet. */
export type ContactVia = "phone" | "email" | "none"

/** The first contact of one website customer. */
export interface FirstContact {
    /** Who makes it: a connection (zns, sms) or the owner. */
    readonly route: FirstContactRoute
    /** What the customer gave to be reached by. */
    readonly via: ContactVia
}

/** What the form gave to reach the customer, already cleaned. */
export interface FormContact {
    /** The phone in the shape the lead keeps, or null. */
    readonly phone: string | null
    /** The email in the shape the lead keeps, or null. */
    readonly email: string | null
}

/** The first contact: ZNS, else SMS, only to a phone and only on a route the workspace has; otherwise the owner's item. */
export const firstContactOf = (contact: FormContact, routes: ReadonlyArray<OutboundRoute>): FirstContact => {
    if (contact.phone !== null) {
        if (routes.includes("zns")) return { route: "zns", via: "phone" }
        if (routes.includes("sms")) return { route: "sms", via: "phone" }
        return { route: "owner_item", via: "phone" }
    }
    return { route: "owner_item", via: contact.email === null ? "none" : "email" }
}

/** What a website customer's wake needs from the accepted form. */
export interface WebsiteLeadFacts {
    /** The customer the form is. */
    readonly leadId: string
    /** The input that recorded the form. */
    readonly inboundEventId: string
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
 * The plain data the woken agent's graph reads as `trigger.context`. It is a buying conversation with known facts and no chat: `chat` is
 * false, so no node may reply into a conversation, and `firstContact` says which route is real. Items, delivery time and address are not
 * fields of the form yet, so they live in `request` as the customer wrote them; nothing here guesses them.
 */
export const websiteLeadPayloadOf = (
    facts: WebsiteLeadFacts,
    first: FirstContact,
): Readonly<Record<string, unknown>> => ({
    kind: WEBSITE_LEAD_KIND,
    leadId: facts.leadId,
    inboundEventId: facts.inboundEventId,
    contact: { name: facts.name, phone: facts.phone, email: facts.email },
    request: facts.request,
    source: facts.source,
    chat: false,
    firstContact: first,
})

/** The key one accepted form wakes under: the form written twice, or retried after a failure, is one wake. */
export const websiteLeadEventKeyOf = (inboundEventId: string): string => `${WEBSITE_LEAD_KIND}:${inboundEventId}`

/** The words a wake names its customer by: the name, else the phone, else the email, else nothing. */
export const websiteLeadWhoOf = (facts: WebsiteLeadFacts): string => facts.name ?? facts.phone ?? facts.email ?? ""
