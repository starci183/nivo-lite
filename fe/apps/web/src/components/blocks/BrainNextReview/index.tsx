"use client"

import { useTranslations } from "next-intl"
import { useWaitingFactCount } from "@/hooks/brain"
import { brainTabHref } from "@/modules/routes"
import { BrainNextReviewBase } from "./component"

/** After documents came in: the facts that wait for review, linked to the queue where they are decided. Nothing is drawn while none waits. */
export const BrainNextReview = () => {
    const t = useTranslations("secondBrain")
    const waiting = useWaitingFactCount()
    if (waiting === 0) return null
    return <BrainNextReviewBase props={{ label: t("nextReview", { count: waiting }), href: brainTabHref("todo") }} />
}
