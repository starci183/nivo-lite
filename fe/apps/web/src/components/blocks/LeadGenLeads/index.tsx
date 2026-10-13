"use client"

import { useFormatter, useTranslations } from "next-intl"
import { SCORE_TONES, useLeadGenWorkbench } from "@/hooks/leadgen"
import { LeadGenLeadsBase } from "./component"

/** The agent the workbench is read for. */
interface LeadGenLeadsProps {
    readonly installationId: string | null
}

/** The prospects tab: the words of each row are resolved here. */
export const LeadGenLeads = (props: LeadGenLeadsProps) => {
    const t = useTranslations("workbenchLeadGen")
    const format = useFormatter()
    const { data } = useLeadGenWorkbench(props.installationId)
    const hidden = data?.leadsHidden ?? 0
    if (data === undefined) return null
    return (
        <LeadGenLeadsBase
            props={{
                label: t("leadsLabel"),
                emptyTitle: t("leadsEmptyTitle"),
                emptyBody: t("leadsEmptyBody"),
                hiddenText: hidden > 0 ? t("leadsHidden", { n: hidden }) : null,
                rows: (data?.leads ?? []).map((row) => ({
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
                    scoreTone: row.score ? (SCORE_TONES[row.score] ?? "neutral") : "neutral",
                })),
            }}
        />
    )
}
