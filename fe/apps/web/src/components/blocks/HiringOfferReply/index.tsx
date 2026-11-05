"use client"

import { useTranslations } from "next-intl"
import { useHiringFormat, useHiringSay } from "@/hooks/hiring"
import { useHiringOfferReply, usePublicHiringOffer } from "@/hooks/hiringPublic"
import type { PublicOfferView } from "@/hooks/hiringPublic"
import { useLocaleSwitch } from "@/hooks/locale"
import { slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { HiringOfferReplyBase } from "./component"
import type { HiringOfferReplyShape } from "./component"

/** The token of the candidate's own link. */
interface HiringOfferReplyProps {
    readonly token: string
}

/** How the letter stands: open to an answer, answered, or expired; an open shape stands in while it is read. */
const shapeOf = (view: PublicOfferView | undefined): HiringOfferReplyShape => {
    if (view === undefined) return "open"
    if (view.status === "accepted" || view.status === "declined") return view.status
    return view.isOpen ? "open" : "expired"
}

/** The connected offer link: reads the letter without a session and sends the answer through the back end GraphQL API. */
export const HiringOfferReply = (props: HiringOfferReplyProps) => {
    const read = usePublicHiringOffer(props.token)
    const reply = useHiringOfferReply(props.token)
    const slotLabels = useSlotLabels()
    const language = useLocaleSwitch()
    const t = useTranslations("hiring")
    const say = useHiringSay()
    const format = useHiringFormat()
    const view = read.view
    return (
        <HiringOfferReplyBase
            shape={shapeOf(view)}
            props={{
                say,
                slot: read.isMissing
                    ? { isEmpty: true }
                    : slotOfSwr({
                          data:
                              view === undefined
                                  ? undefined
                                  : {
                                        shop: view.shop,
                                        heading: t("replyOfferHeading", { title: view.title }),
                                        letter: view.letter,
                                        validUntil: view.expiresAt
                                            ? t("replyValidUntil", { date: format.date(view.expiresAt) })
                                            : null,
                                        acceptedTitle: t("replyAcceptedTitle"),
                                    },
                          error: read.isFailed ? true : undefined,
                          isLoading: read.isLoading,
                      }),
                slotLabels: { ...slotLabels(say("replyInvalid")), error: say("replyLoadFailedOffer") },
                failedBody: say("replyLoadFailedBody"),
                language: {
                    label: language.label,
                    locale: language.locale,
                    isPending: language.isPending,
                    options: language.options,
                },
                outcome: reply.outcome,
                isBusy: reply.isPending,
            }}
            on={{ answer: reply.answer, retry: read.reload, chooseLanguage: language.choose }}
        />
    )
}
