"use client"

import { useFormatter, useTranslations } from "next-intl"
import { actionWordOf } from "@/hooks/actionWord"
import type { ActivityItemView, SalesWorkbenchData } from "@/modules/types"
import { EVIDENCE_TONES } from "./sales.shared"

type UseSalesActivityViewResult = {
    label: string
    intro: string
    emptyTitle: string
    emptyBody: string
    rows: readonly ActivityItemView[]
    evidenceTitle: string
    byPolicy: string
}

/** Resolves the same routine-work rows from the workbench read owned by Sales. */
export const useSalesActivityView = (data: SalesWorkbenchData | null): UseSalesActivityViewResult => {
    const t = useTranslations("workbenchSales")
    const g = useTranslations("governance")
    const format = useFormatter()
    const rows: ReadonlyArray<ActivityItemView> = (data?.activity ?? []).map((row) => ({
        id: row.id,
        action: actionWordOf(g, row.action),
        evidenceLabel: t(`evidence_${row.evidenceState}`),
        evidenceTone: EVIDENCE_TONES[row.evidenceState],
        when: format.dateTime(new Date(row.at), {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        }),
        customer: row.customer ?? "",
        href: row.href,
        summary: row.summary,
        evidence: row.evidence,
    }))
    return {
        label: t("tab_activity"),
        intro: t("activityIntro"),
        emptyTitle: t("activityEmptyTitle"),
        emptyBody: t("activityEmptyBody"),
        rows,
        evidenceTitle: t("evidenceLabel"),
        byPolicy: t("byPolicy"),
    }
}
