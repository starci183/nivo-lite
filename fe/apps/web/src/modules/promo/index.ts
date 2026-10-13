import { PRODUCT_TIME_ZONE } from "@/modules/i18n/routing"

/** The Founding 50 campaign: its numbers, its window and where it leads. Wording lives in the promo catalogs; the owner confirms every figure before it is published. */
export const FOUNDING_OFFER = {
    enabled: true,
    name: "Founding 50",
    percentOff: 50,
    cap: 50,
    startsAt: "2026-09-29T00:00:00+07:00",
    endsAt: "2026-10-31T23:59:59+07:00",
    /** The real number of founding slots taken, set by the owner; null hides the counter and the number is never guessed. */
    slotsClaimed: null as number | null,
    ctaHref: "/modules/new?module=chatbot",
} as const

/** True while the campaign is switched on and `now` (epoch milliseconds) is inside its window. */
export const isOfferLive = (now: number): boolean =>
    FOUNDING_OFFER.enabled && now >= Date.parse(FOUNDING_OFFER.startsAt) && now <= Date.parse(FOUNDING_OFFER.endsAt)

/** The end of the offer in the reader's locale, such as "31 Oct 2026". */
export const offerEndLabel = (locale: string): string =>
    new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: PRODUCT_TIME_ZONE,
    }).format(new Date(FOUNDING_OFFER.endsAt))

/** The storage key of a dismissed promo card. */
export const dismissKey = (id: string): string => `nivo.promo.dismissed.${id}`

/** One onboarding step; `done` comes from real rows and events only. */
export interface OnboardingStep {
    /** The stable key of the step. */
    readonly key: string
    /** What the step is. */
    readonly label: string
    /** Why it matters. */
    readonly hint: string
    /** Whether the workspace already did it. */
    readonly done: boolean
    /** Where the step is done. */
    readonly href: string
    /** The text of the button that goes there. */
    readonly cta: string
}

/** Website-channel lead facts of a workspace; the wait is null when no lead has a recorded first response. */
export interface WebsiteLeadStats {
    /** Website leads. */
    readonly count: number
    /** Of them, those captured outside opening hours. */
    readonly afterHoursCount: number
    /** The average hours to the first response, or null. */
    readonly avgWaitHours: number | null
}

/** Everything the campaign and onboarding surfaces need, all from the workspace's own data. */
export interface PromoState {
    /** Whether the workspace owns a chatbot agent. */
    readonly hasChatbot: boolean
    /** The chatbot agent, or null. */
    readonly chatbotAgentId: string | null
    /** Whether the workspace bought a module inside the Founding 50 window. */
    readonly isFoundingMember: boolean
    /** Website-lead facts. */
    readonly websiteLeadStats: WebsiteLeadStats
    /** The onboarding steps. */
    readonly onboarding: ReadonlyArray<OnboardingStep>
}

/** The raw facts of the `promo_state` function (also embedded in `dashboard_data`). */
export interface PromoRaw {
    /** The chatbot agent and its knowledge text, or null. */
    readonly chatbot: { readonly id: string; readonly knowledge: string } | null
    /** Whether a module was bought inside the window. */
    readonly is_founding_member: boolean
    /** Website leads. */
    readonly website_leads: ReadonlyArray<{ readonly id: string; readonly created_at: string }>
    /** The first event of each lead. */
    readonly first_events: ReadonlyArray<{ readonly lead_id: string; readonly at: string }>
    /** Whether a customer conversation exists. */
    readonly has_customer_conversation: boolean
    /** Whether a lead conversation exists. */
    readonly has_lead_conversation: boolean
    /** Approved actions. */
    readonly approved_count: number
    /** Whether a lead was won. */
    readonly has_won: boolean
    /** Whether an invoice was approved. */
    readonly invoice_approved: boolean
}

/** Whether the workspace owns a Chatbot, and how to address it. */
export interface ChatbotState {
    /** True when a chatbot agent exists. */
    readonly hasChatbot: boolean
    /** Its id. */
    readonly agentId: string | null
    /** Its handle. */
    readonly handle: string | null
    /** Its name. */
    readonly name: string | null
}

/** What the lead page can honestly say about a website lead. */
export interface LeadWait {
    /** Show the nudge at all: website channel and no chatbot in this workspace. */
    readonly show: boolean
    /** Whole hours between capture and the first approved reply (or now, if none), only when computable. */
    readonly hours: number | null
    /** Whether a reply was approved. */
    readonly replied: boolean
}
