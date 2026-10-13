import { PRODUCT_TIME_ZONE } from "@/modules/i18n/routing"
import type { OnboardingStep, PromoRaw, PromoState } from "@/modules/promo"

/** Translates one key of the promo catalog. */
export type PromoTranslate = (key: string) => string

const HOUR = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: PRODUCT_TIME_ZONE })
const HOUR_MS = 3_600_000
const OPENING_HOUR = 8
const CLOSING_HOUR = 18

const isAfterHours = (iso: string): boolean => {
    const hour = Number(HOUR.format(new Date(iso)))
    return hour < OPENING_HOUR || hour >= CLOSING_HOUR
}

/** The average hours between each website lead and its first event, or null when no lead has one. */
const averageWait = (raw: PromoRaw): number | null => {
    const first = new Map(raw.first_events.map((event) => [event.lead_id, Date.parse(event.at)]))
    const waits = raw.website_leads.flatMap((lead) => {
        const at = first.get(lead.id)
        const wait = at === undefined ? null : (at - Date.parse(lead.created_at)) / HOUR_MS
        return wait !== null && wait >= 0 ? [wait] : []
    })
    return waits.length === 0 ? null : waits.reduce((sum, wait) => sum + wait, 0) / waits.length
}

const stepOf = (t: PromoTranslate, key: string, done: boolean, href: string): OnboardingStep => ({
    key,
    label: t(`step${key}`),
    hint: t(`hint${key}`),
    done,
    href,
    cta: t(`cta${key}`),
})

/** The promo and onboarding state from the raw facts of `promo_state`. */
export const buildPromoState = (raw: PromoRaw, t: PromoTranslate): PromoState => {
    const chatbot = raw.chatbot
    const newChatbot = "/modules/new?module=chatbot"
    const chatHref = chatbot === null ? newChatbot : `/modules/${chatbot.id}/chat`
    const knowledgeHref = chatbot === null ? newChatbot : `/modules/${chatbot.id}`
    return {
        hasChatbot: chatbot !== null,
        chatbotAgentId: chatbot?.id ?? null,
        isFoundingMember: raw.is_founding_member,
        websiteLeadStats: {
            count: raw.website_leads.length,
            afterHoursCount: raw.website_leads.filter((lead) => isAfterHours(lead.created_at)).length,
            avgWaitHours: averageWait(raw),
        },
        onboarding: [
            stepOf(t, "Buy", chatbot !== null, newChatbot),
            stepOf(t, "Knowledge", (chatbot?.knowledge ?? "").trim().length > 0, knowledgeHref),
            stepOf(t, "Test", raw.has_customer_conversation, chatHref),
            stepOf(t, "Lead", raw.has_lead_conversation, chatHref),
            stepOf(t, "Approve", raw.approved_count > 0, "/chat"),
            stepOf(t, "Won", raw.has_won, "/leads"),
            stepOf(t, "Invoice", raw.invoice_approved, "/responsibilities"),
        ],
    }
}
