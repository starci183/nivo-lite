"use client"

import { useTranslations } from "next-intl"
import { useLeadWait, usePromoOffer } from "@/hooks/promo"
import { PromoLeadWaitBase } from "./component"

interface PromoLeadWaitProps {
    /** The website lead whose factual wait is shown. */
    readonly leadId: string
}

/** Connects the wait note to GraphQL; the backend proves which leads qualify. */
export const PromoLeadWait = (props: PromoLeadWaitProps) => {
    const t = useTranslations("promoAds")
    const { data } = useLeadWait(props.leadId)
    const offer = usePromoOffer()
    if (!data?.show) return null
    const nudgeKey = data.replied ? "nudgeReplied" : "nudgeWaiting"
    const detail = data.hours == null ? "" : ` ${t(nudgeKey, { h: data.hours })}`
    return (
        <PromoLeadWaitBase
            props={{ text: `${t("nudgeBody")}${detail}`, seeLabel: t("seeChatbot"), seeHref: offer.ctaHref }}
        />
    )
}
