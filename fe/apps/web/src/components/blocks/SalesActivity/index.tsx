"use client"

import { useFormatter, useTranslations } from "next-intl"
import { EVIDENCE_TONES } from "@/hooks/sales"
import type { AutoActivity } from "@/modules/types"
import { SalesActivityBase } from "./component"

/** What NIVO did by policy. */
interface SalesActivityProps {
    readonly rows: ReadonlyArray<AutoActivity>
}

/** The activity surface: routine work done by policy with the evidence behind it. */
export const SalesActivity = (props: SalesActivityProps) => {
    const t = useTranslations("workbenchSales")
    const g = useTranslations("governance")
    const format = useFormatter()
    return (
        <SalesActivityBase
            props={{
                label: t("tab_activity"),
                intro: t("activityIntro"),
                emptyTitle: t("activityEmptyTitle"),
                emptyBody: t("activityEmptyBody"),
                rows: props.rows.map((row) => ({
                    id: row.id,
                    action: g(`action_${row.action}`),
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
                })),
                evidenceTitle: t("evidenceLabel"),
                byPolicy: t("byPolicy"),
            }}
        />
    )
}
