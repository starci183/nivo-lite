import type { DashboardType } from "@/hooks/swr"
import type { OnboardingStep } from "@/modules/promo"

/** The promo facts of the dashboard. */
type Promo = DashboardType["promo"]

/** Translates one key of the promo catalog. */
export type PromoTranslator = (key: string) => string

const NEW_CHATBOT = "/modules/new?module=chatbot"

const stepOf = (t: PromoTranslator, key: string, done: boolean, href: string): OnboardingStep => ({
    key,
    label: t(`step${key}`),
    hint: t(`hint${key}`),
    done,
    href,
    cta: t(`cta${key}`),
})

/** The onboarding steps, each done or not from the real facts of the workspace. */
export const onboardingStepsOf = (promo: Promo, t: PromoTranslator): Array<OnboardingStep> => {
    const chatbot = promo.chatbot
    const chatHref = chatbot ? `/modules/${chatbot.id}/chat` : NEW_CHATBOT
    const knowledgeHref = chatbot ? `/modules/${chatbot.id}` : NEW_CHATBOT
    return [
        stepOf(t, "Buy", chatbot !== null, NEW_CHATBOT),
        stepOf(t, "Knowledge", (chatbot?.knowledge ?? "").trim().length > 0, knowledgeHref),
        stepOf(t, "Test", promo.hasCustomerConversation, chatHref),
        stepOf(t, "Lead", promo.hasLeadConversation, chatHref),
        stepOf(t, "Approve", promo.approvedCount > 0, "/chat"),
        stepOf(t, "Won", promo.hasWon, "/leads"),
        stepOf(t, "Invoice", promo.invoiceApproved, "/responsibilities"),
    ]
}
