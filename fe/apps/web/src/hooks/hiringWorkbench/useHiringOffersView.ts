"use client"
import { useTranslations } from "next-intl"
import { OPEN_OFFER_STATUSES, offerStatusTone, useHiringFormat } from "@/hooks/hiring"
import { useHiringOffers } from "@/hooks/hiringOffers"
import { useHiringBenchStore } from "@/hooks/zustand/hiringBench"
import type { OfferView } from "@/hooks/hiringWire"
import { CONSOLE_ROUTES } from "@/modules/routes"
import type { HiringViewInput } from "./hiringWorkbench.shared"
import type { HiringWorkbenchCopy } from "@/modules/types"
import type { BadgeTone } from "@starci/grammar/common"

type ResolvedActions = {
    readonly open: (candidateId: string) => void
    readonly copy: (id: string) => void
    readonly cancel: (id: string) => void
    readonly clearError: () => void
}

/** Resolves the offer link label only after it has been sent. */
const offerCopyLabel = (offer: OfferView, copiedId: string | null, t: ReturnType<typeof useTranslations<"hiring">>) => {
    if (offer.status !== "sent") return null
    return t(copiedId === offer.id ? "copiedLink" : "offersCopy")
}
/** The view `useHiringOffersView` returns. */
export interface HiringOffersViewShape {
    props: {
        copy: HiringWorkbenchCopy
        approveLabel: string | null
        decisionsHref: "/decisions"
        fact: string
        rows: {
            id: string
            candidateId: string
            name: string
            statusLabel: string
            statusTone: BadgeTone
            meta: string
            sent: string | null
            isWaiting: boolean
            copyLabel: string | null
            canCancel: boolean
        }[]
        isBusy: boolean
        error: string | null
    }
    on: ResolvedActions
}

/** Owns HiringOffers's resolved data, commands and actual panel activation. */
export const useHiringOffersView = (input: HiringViewInput): HiringOffersViewShape => {
    const owner = { isActive: input.isActive && input.isReady, scope: input.scope }

    const t = useTranslations("hiring")
    const format = useHiringFormat()
    const view = useHiringOffers(owner)
    const data = input.board
    const { open } = useHiringBenchStore()
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
        copyLabel: offerCopyLabel(offer, view.copiedId, t),
        canCancel: OPEN_OFFER_STATUSES.includes(offer.status),
    })

    const props = {
        copy: input.copy,
        approveLabel: data.waitingApprovals > 0 ? t("offersApproveAll", { n: data.waitingApprovals }) : null,
        decisionsHref: CONSOLE_ROUTES.decisions,
        fact: t("offersFact", { n: data.offers.length }),
        rows: data.offers.map(rowOf),
        isBusy: view.isPending,
        error: view.error,
    }
    const on: ResolvedActions = {
        open,
        copy: (id) => {
            const offer = data.offers.find((entry) => entry.id === id)
            if (offer !== undefined) view.copyLink(id, `${data.origin}/j/thu/${offer.token}`)
        },
        cancel: view.cancelOffer,
        clearError: view.clearError,
    }
    return { props, on }
}
