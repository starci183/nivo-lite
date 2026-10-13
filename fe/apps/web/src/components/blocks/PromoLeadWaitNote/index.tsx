"use client"

import { useTranslations } from "next-intl"
import { useLeadWait } from "@/hooks/leads"
import { usePromoOffer } from "@/hooks/promo"
import { PromoLeadWaitNoteBase } from "./component"

interface PromoLeadWaitNoteProps {
    /** The website lead the note is about. */
    readonly leadId: string
}

/** The connected wait note, read on the server: shown for a website lead in a workspace without a Chatbot, with wait hours only when they come from real events. */
export const PromoLeadWaitNote = (props: PromoLeadWaitNoteProps) => {
    const t = useTranslations("promoAds")
    const offer = usePromoOffer()
    const { data: wait } = useLeadWait(props.leadId)
    if (wait === undefined || !wait.show) return null
    const detail = wait.hours == null ? "" : ` ${t(wait.replied ? "nudgeReplied" : "nudgeWaiting", { h: wait.hours })}`
    return (
        <PromoLeadWaitNoteBase
            props={{ text: `${t("nudgeBody")}${detail}`, seeLabel: t("seeChatbot"), seeHref: offer.ctaHref }}
        />
    )
}
