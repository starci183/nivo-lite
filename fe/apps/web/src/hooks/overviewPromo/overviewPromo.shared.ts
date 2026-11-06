import type { DashboardType } from "@/hooks/swr"
import type { OnboardingStep } from "@/modules/promo"
import { CONSOLE_ROUTES, agentChatHref, newModulePath, workspaceHref } from "@/modules/routes"

/** The promo facts of the dashboard. */
type Promo = DashboardType["promo"]

/** Translates one key of the promo catalog. */
export type PromoTranslator = (key: string) => string

/** The three catalog keys of one onboarding step, written out so each key is read as itself. */
interface StepWords {
    readonly label: string
    readonly hint: string
    readonly cta: string
}

const stepOf = (t: PromoTranslator, key: string, words: StepWords, done: boolean, href: string): OnboardingStep => ({
    key,
    label: t(words.label),
    hint: t(words.hint),
    done,
    href,
    cta: t(words.cta),
})

/** The onboarding steps, each done or not from the real facts of the workspace. */
export const onboardingStepsOf = (promo: Promo, t: PromoTranslator, workspaceId: string): Array<OnboardingStep> => {
    const chatbot = promo.chatbot
    const at = (path: string): string => workspaceHref(workspaceId, path)
    const newChatbot = at(newModulePath("chatbot"))
    const chatHref = chatbot ? at(agentChatHref(chatbot.id)) : newChatbot
    const knowledgeHref = chatbot ? at(newModulePath("chatbot")) : newChatbot
    return [
        stepOf(t, "Buy", { label: "stepBuy", hint: "hintBuy", cta: "ctaBuy" }, chatbot !== null, newChatbot),
        stepOf(
            t,
            "Knowledge",
            { label: "stepKnowledge", hint: "hintKnowledge", cta: "ctaKnowledge" },
            (chatbot?.knowledge ?? "").trim().length > 0,
            knowledgeHref,
        ),
        stepOf(
            t,
            "Test",
            { label: "stepTest", hint: "hintTest", cta: "ctaTest" },
            promo.hasCustomerConversation,
            chatHref,
        ),
        stepOf(t, "Lead", { label: "stepLead", hint: "hintLead", cta: "ctaLead" }, promo.hasLeadConversation, chatHref),
        stepOf(
            t,
            "Approve",
            { label: "stepApprove", hint: "hintApprove", cta: "ctaApprove" },
            promo.approvedCount > 0,
            at(CONSOLE_ROUTES.chat),
        ),
        stepOf(t, "Won", { label: "stepWon", hint: "hintWon", cta: "ctaWon" }, promo.hasWon, at(CONSOLE_ROUTES.leads)),
        stepOf(
            t,
            "Invoice",
            { label: "stepInvoice", hint: "hintInvoice", cta: "ctaInvoice" },
            promo.invoiceApproved,
            at(CONSOLE_ROUTES.responsibilities),
        ),
    ]
}
