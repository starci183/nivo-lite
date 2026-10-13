"use client"

import { useTranslations } from "next-intl"
import { useHiringFormat, useHiringSay } from "@/hooks/hiring"
import { useHiringOfferReply, usePublicHiringOffer } from "@/hooks/hiringPublic"
import type { PublicOfferView } from "@/hooks/hiringPublic"
import { HiringOfferReplyBase } from "./component"
import type { HiringOfferReplyBaseProps } from "./component"

/** The token of the candidate's own link. */
interface HiringOfferReplyProps {
    readonly token: string
}

type ReplyState = HiringOfferReplyBaseProps["props"]["state"]

/** Where the letter stands: still loading, no longer valid, open to an answer, answered, or expired. */
const stateOf = (isMissing: boolean, view: PublicOfferView | undefined): ReplyState => {
    if (isMissing) return "missing"
    if (view === undefined) return "loading"
    if (view.status === "accepted" || view.status === "declined") return view.status
    return view.isOpen ? "open" : "expired"
}

/** The connected offer link: reads the letter without a session and sends the answer through the back end GraphQL API. */
export const HiringOfferReply = (props: HiringOfferReplyProps) => {
    const t = useTranslations("hiring")
    const say = useHiringSay()
    const format = useHiringFormat()
    const read = usePublicHiringOffer(props.token)
    const reply = useHiringOfferReply(props.token)
    const view = read.view
    return (
        <HiringOfferReplyBase
            props={{
                say,
                state: stateOf(read.isMissing, view),
                shop: view?.shop ?? "",
                heading: t("replyOfferHeading", { title: view?.title ?? "" }),
                letter: view?.letter ?? "",
                validUntil: view?.expiresAt ? t("replyValidUntil", { date: format.date(view.expiresAt) }) : null,
                acceptedTitle: t("replyAcceptedTitle", { name: view?.candidateName ?? "" }),
                outcome: reply.outcome,
                isBusy: reply.isPending,
            }}
            on={{ answer: reply.answer }}
        />
    )
}
