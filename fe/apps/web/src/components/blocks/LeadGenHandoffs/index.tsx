"use client"

import { useFormatter, useTranslations } from "next-intl"
import { CLASSIFY_TONES, LEAD_STAGES, SCORE_TONES } from "@/hooks/leadgen"
import type { LeadGenHandoff } from "@/modules/types"
import { LeadGenHandoffsBase } from "./component"

/** The leads handed to Sales. */
interface LeadGenHandoffsProps {
    readonly rows: ReadonlyArray<LeadGenHandoff>
}

/** The hand-offs tab: the words of each row are resolved here. */
export const LeadGenHandoffs = (props: LeadGenHandoffsProps) => {
    const t = useTranslations("workbenchLeadGen")
    const format = useFormatter()
    const stageName = (stage: string): string => (LEAD_STAGES.includes(stage) ? t(`stage_${stage}`) : stage)
    return (
        <LeadGenHandoffsBase
            props={{
                label: t("handoffsLabel"),
                emptyTitle: t("handoffsEmptyTitle"),
                emptyBody: t("handoffsEmptyBody"),
                rows: props.rows.map((row) => ({
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
                    scoreTone: row.score ? SCORE_TONES[row.score] : "neutral",
                    classifyLabel: row.classify ? t(`classify_${row.classify}`) : t("classify_none"),
                    classifyTone: row.classify ? CLASSIFY_TONES[row.classify] : "neutral",
                })),
            }}
        />
    )
}
