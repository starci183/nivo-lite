"use client"

import { useTranslations } from "next-intl"
import { useChatbotPromo, useDismissed, usePromoOffer } from "@/hooks/promo"
import { PromoChatbotCardBase } from "./component"

interface PromoChatbotCardProps {
    /** `row` at the top of the leads list, `card` in the Office conversation. */
    readonly variant: "row" | "card"
    /** True when the workspace already owns a Chatbot: the promo is then never shown. Left out, the card reads it itself. */
    readonly hasChatbot?: boolean
}

/** The connected Chatbot promo: shown while the workspace has no Chatbot and the reader did not dismiss it. */
export const PromoChatbotCard = (props: PromoChatbotCardProps) => {
    const t = useTranslations("promoAds")
    const offer = usePromoOffer()
    const { ready, dismissed, dismiss } = useDismissed(props.variant === "row" ? "leads-chatbot" : "office-chatbot")
    const chatbot = useChatbotPromo(props.hasChatbot === undefined)
    const hasChatbot = props.hasChatbot ?? chatbot.data?.hasChatbot
    if (hasChatbot !== false || !ready || dismissed) return null
    const row = props.variant === "row"
    const liveLine = row ? t("leadsRowLive") : t("officeOffer")
    const plainLine = row ? t("leadsRowPlain") : null
    return (
        <PromoChatbotCardBase
            props={{
                variant: props.variant,
                tag: row ? null : t("officeTag"),
                title: row ? t("leadsRowTitle") : t("officeBody"),
                body: offer.live ? liveLine : plainLine,
                actionLabel: row ? t("seeChatbot") : t("addChatbot"),
                actionHref: offer.ctaHref,
                dismissLabel: t("dismiss"),
            }}
            on={{ dismiss }}
        />
    )
}
