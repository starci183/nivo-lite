"use client"

import { useFormatter, useTranslations } from "next-intl"
import { CLASSIFY_TONES, LEAD_STAGES, SCORE_TONES, useLeadGenWorkbench } from "@/hooks/leadgen"
import { LeadGenHandoffsBase } from "./component"

/** The agent the workbench is read for. */
interface LeadGenHandoffsProps {
    readonly installationId: string | null
}

/** The hand-offs tab: the words of each row are resolved here. */
export const LeadGenHandoffs = (props: LeadGenHandoffsProps) => {
    const t = useTranslations("workbenchLeadGen")
    const format = useFormatter()
    const { data } = useLeadGenWorkbench(props.installationId)
    const stageName = (stage: string): string => (LEAD_STAGES.includes(stage) ? t(`stage_${stage}`) : stage)
    if (data === undefined) return null
    return (
        <LeadGenHandoffsBase
            props={{
                label: t("handoffsLabel"),
                emptyTitle: t("handoffsEmptyTitle"),
                emptyBody: t("handoffsEmptyBody"),
                rows: (data?.handoffs ?? []).map((row) => ({
                    key: row.key,
                    name: row.name,
                    href: row.href,
                    line: [
                        t("stageLine", { stage: stageName(row.stage) }),
                        format.dateTime(new Date(row.at), {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                        }),
                    ].join(" · "),
                    scoreLabel: row.score ? t(`score_${row.score}`) : t("score_none"),
                    scoreTone: row.score ? (SCORE_TONES[row.score] ?? "neutral") : "neutral",
                    classifyLabel: row.classify ? t(`classify_${row.classify}`) : t("classify_none"),
                    classifyTone: row.classify ? (CLASSIFY_TONES[row.classify] ?? "neutral") : "neutral",
                })),
            }}
        />
    )
}
