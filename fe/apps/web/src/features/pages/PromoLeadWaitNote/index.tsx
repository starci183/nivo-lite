import { getTranslations } from "next-intl/server"
import { readLeadWait } from "@/modules/db/promo/read-lead-wait"
import { FOUNDING_OFFER } from "@/modules/promo"
import { PromoLeadWaitNoteBase } from "./component"

interface PromoLeadWaitNoteProps {
    /** The website lead the note is about. */
    readonly leadId: string
}

/** The connected wait note, read on the server: shown for a website lead in a workspace without a Chatbot, with wait hours only when they come from real events. */
export const PromoLeadWaitNote = async (props: PromoLeadWaitNoteProps) => {
    const t = await getTranslations("promoAds")
    const outcome = await readLeadWait(props.leadId)
    if (outcome.kind !== "ok" || !outcome.value.show) return null
    const wait = outcome.value
    const detail = wait.hours === null ? "" : ` ${t(wait.replied ? "nudgeReplied" : "nudgeWaiting", { h: wait.hours })}`
    return (
        <PromoLeadWaitNoteBase
            props={{ text: `${t("nudgeBody")}${detail}`, seeLabel: t("seeChatbot"), seeHref: FOUNDING_OFFER.ctaHref }}
        />
    )
}
