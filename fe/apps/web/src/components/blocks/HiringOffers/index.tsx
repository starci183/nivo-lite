"use client"

import { useTranslations } from "next-intl"
import { OPEN_OFFER_STATUSES, offerStatusTone, useHiringFormat, useHiringSay } from "@/hooks/hiring"
import { useHiringOffers } from "@/hooks/hiringOffers"
import type { HiringWorkbenchData, OfferView } from "@/hooks/hiringWire"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { HiringOffersBase } from "./component"

/** The workbench the tab reads and the way to open a candidate. */
interface HiringOffersProps {
    readonly data: HiringWorkbenchData
    readonly onOpen: (candidateId: string) => void
}

/** The connected offers tab: every offer with where it stands, its letter link and the cancel command. */
export const HiringOffers = (props: HiringOffersProps) => {
    const t = useTranslations("hiring")
    const say = useHiringSay()
    const format = useHiringFormat()
    const view = useHiringOffers()
    const { data } = props
    const names = new Map(data.candidates.map((candidate) => [candidate.id, candidate.name]))
    const titles = new Map(data.jobs.map((job) => [job.id, job.title]))
    const sentOf = (offer: OfferView): string | null => {
        if (offer.sentAt === null) return null
        const via =
            offer.sentVia === "chat" || offer.sentVia === "email"
                ? t(`offersVia_${offer.sentVia}`)
                : t("offersViaManual")
        const sent = t("offersSent", { date: format.date(offer.sentAt), via })
        return offer.expiresAt === null
            ? sent
            : `${sent} · ${t("offersExpires", { date: format.date(offer.expiresAt) })}`
    }
    const rowOf = (offer: OfferView) => ({
        id: offer.id,
        candidateId: offer.candidateId,
        name: names.get(offer.candidateId) ?? t("candidateFallback"),
        statusLabel: format.label("offerStatus", offer.status),
        statusTone: offerStatusTone(offer.status),
        meta: [
            titles.get(offer.jobId),
            offer.pay,
            offer.startDate === "" ? "" : t("offersStart", { date: offer.startDate }),
        ]
            .filter((part) => part !== undefined && part !== "")
            .join(" · "),
        sent: sentOf(offer),
        isWaiting: offer.status === "waiting",
        copyLabel: offer.status === "sent" ? t(view.copiedId === offer.id ? "copiedLink" : "offersCopy") : null,
        canCancel: OPEN_OFFER_STATUSES.includes(offer.status),
    })
    return (
        <HiringOffersBase
            props={{
                say,
                approveLabel: data.waitingApprovals > 0 ? t("offersApproveAll", { n: data.waitingApprovals }) : null,
                decisionsHref: CONSOLE_ROUTES.decisions,
                fact: t("offersFact", { n: data.offers.length }),
                rows: data.offers.map(rowOf),
                isBusy: view.isPending,
                error: view.error,
            }}
            on={{
                open: props.onOpen,
                copy: (id) => {
                    const offer = data.offers.find((entry) => entry.id === id)
                    if (offer !== undefined) view.copyLink(id, `${data.origin}/j/thu/${offer.token}`)
                },
                cancel: view.cancelOffer,
                clearError: view.clearError,
            }}
        />
    )
}
