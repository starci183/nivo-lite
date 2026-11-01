"use client"

import type { AccountingWorkbenchData, AccountingPeriodKey } from "@/modules/types"
import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { dayOf, moneyOf, monthOf } from "@/modules/utils"

/** The three ageing buckets as gauges: how much is owed at each age, the oldest drawn as the most serious. */
const AGEING_BUCKETS = [
    { id: "d0", key: "ageingD0", tone: "neutral" },
    { id: "d30", key: "ageingD30", tone: "cautionary" },
    { id: "d60", key: "ageingD60", tone: "negative" },
] as const

/**
 * The Period overview tab: the period choice lives here, the drawing in the pure half. The figures of the period are the ribbon of
 * the desk, so this tab holds only what the ribbon does not: the ageing and the weeks of income.
 */
export const useAccountingOverview = (data: AccountingWorkbenchData) => {
    const t = useTranslations("workbenchAccounting")
    const format = useFormatter()
    const [periodKey, setPeriodKey] = useState<AccountingPeriodKey>("this")
    const actions = { selectPeriod: (key: string) => setPeriodKey(key === "last" ? "last" : "this") }
    const period = data.periods[periodKey]
    const month = monthOf(format, period.fromIso)

    const weekMax = Math.max(0, ...period.weeks.map((week) => week.vnd))
    const ageingMax = Math.max(0, ...AGEING_BUCKETS.map((bucket) => data.ageing[bucket.id].vnd))

    return {
        props: {
            title: t("overviewTitle"),
            intro: t("overviewIntro", { month }),
            periodLabel: t("periodLabel"),
            periodItems: [
                { id: "this", label: t("periodThis") },
                { id: "last", label: t("periodLast") },
            ],
            selectedPeriod: periodKey,
            excludedNote: data.excludedTest > 0 ? t("excludedTest", { n: data.excludedTest }) : null,
            trendTitle: t("trendTitle", { month }),
            trendIntro: t("trendIntro"),
            trendSource: `${t("sourceLabel")}: ${t("mIncomeSource")}`,
            trendEmpty: t("trendEmpty"),
            ageingTitle: t("ageingTitle"),
            ageingIntro: t("ageingIntro"),
            ageingEmpty: t("ageingEmpty"),
            ageingMax,
            ageing: AGEING_BUCKETS.map((bucket) => ({
                id: bucket.id,
                label: t(bucket.key, { n: data.ageing[bucket.id].count }),
                total: data.ageing[bucket.id].vnd,
                reading: moneyOf(format, data.ageing[bucket.id].vnd),
                tone: bucket.tone,
            })),
            weekMax,
            weeks: period.weeks.map((week) => ({
                id: week.startIso,
                label: dayOf(format, week.startIso, false),
                total: week.vnd,
                reading: moneyOf(format, week.vnd),
            })),
        },
        on: actions,
    }
}
