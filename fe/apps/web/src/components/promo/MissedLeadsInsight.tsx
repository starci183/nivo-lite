"use client"

import { Button, SurfaceCard, Text } from "@starci/grammar/common"
import { useT } from "@/i18n/client"
import { promo } from "@/i18n/dict/promo"
import type { WebsiteLeadStats } from "@/modules/promo"
import * as c from "./cardClassNames"

export type MissedLeadsInsightProps = {
    readonly hasChatbot: boolean
    readonly stats: WebsiteLeadStats
    readonly ctaHref?: string
}

/**
 * Insight computed from this workspace's website leads; hidden once a Chatbot exists or when there are no website
 * leads. One top-level `SurfaceCard`; the coral leading edge and the mascot were decoration (DISCIPLINE-1,
 * DISCIPLINE-3: the overview's one signature moment is the Founding 50 band).
 */
export const MissedLeadsInsight = ({
    hasChatbot,
    stats,
    ctaHref = "/modules/new?module=chatbot",
}: MissedLeadsInsightProps) => {
    const t = useT(promo)
    if (hasChatbot || stats.count === 0) return null
    const waitLabel = (hours: number): string => {
        if (hours < 1) return t("waitUnder1")
        if (hours < 48) return Math.round(hours) === 1 ? t("waitHour") : t("waitHours", { n: Math.round(hours) })
        return t("waitDays", { n: Math.round(hours / 24) })
    }
    return (
        <SurfaceCard ariaLabel={t("insightAria")}>
            <div className={c.INSIGHT}>
                <div className={c.INSIGHT_COPY}>
                    <Text size="xs">{t("insightEyebrow")}</Text>
                    <Text size="md" weight="semibold">
                        {t(stats.count === 1 ? "insightTitleOne" : "insightTitle", {
                            after: stats.afterHoursCount,
                            count: stats.count,
                        })}
                    </Text>
                    <Text size="sm" tone="muted">
                        {stats.avgWaitHours !== null
                            ? `${t("insightWait", { wait: waitLabel(stats.avgWaitHours) })} `
                            : ""}
                        {t("insightText")}
                    </Text>
                </div>
                <Button variant="secondary" href={ctaHref}>
                    {t("addChatbot")}
                </Button>
            </div>
        </SurfaceCard>
    )
}
