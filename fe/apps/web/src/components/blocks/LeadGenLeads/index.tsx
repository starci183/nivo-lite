"use client"

import { useFormatter, useTranslations } from "next-intl"
import { SCORE_TONES } from "@/hooks/leadgen"
import type { LeadGenLead } from "@/modules/types"
import { LeadGenLeadsBase } from "./component"

/** The prospects of the Lead Gen workbench and how many more there are. */
interface LeadGenLeadsProps {
    readonly rows: ReadonlyArray<LeadGenLead>
    readonly hidden: number
}

/** The prospects tab: the words of each row are resolved here. */
export const LeadGenLeads = (props: LeadGenLeadsProps) => {
    const t = useTranslations("workbenchLeadGen")
    const format = useFormatter()
    return (
        <LeadGenLeadsBase
            props={{
                label: t("leadsLabel"),
                emptyTitle: t("leadsEmptyTitle"),
                emptyBody: t("leadsEmptyBody"),
                hiddenText: props.hidden > 0 ? t("leadsHidden", { n: props.hidden }) : null,
                rows: props.rows.map((row) => ({
                    id: row.id,
                    name: row.name,
                    href: row.href,
                    lastLine: t("lastLine", {
                        text: row.lastText || "—",
                        when: format.dateTime(new Date(row.lastAt), {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                        }),
                    }),
                    sourceLabel: t("sourceBadge", {
                        platform: t(`platform_${row.origin.platform}`),
                        kind: t(`kind_${row.origin.kind}`),
                    }),
                    scoreLabel: row.score ? t(`score_${row.score}`) : t("score_none"),
                    scoreTone: row.score ? SCORE_TONES[row.score] : "neutral",
                })),
            }}
        />
    )
}
