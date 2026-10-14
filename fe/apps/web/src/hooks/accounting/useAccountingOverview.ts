"use client"

import type { AccountingWorkbenchData } from "@/modules/types"
import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { dayOf, moneyOf, monthOf } from "@/modules/utils"
import { agentHref } from "@/modules/installations"
import type { AccountingMeasure, AccountingPeriodKey } from "@/modules/types"

/** The Period overview tab: the period choice lives here, the drawing in the pure half. */
export const useAccountingOverview = (data: AccountingWorkbenchData | undefined) => {
    const t = useTranslations("workbenchAccounting")
    const format = useFormatter()
    const [periodKey, setPeriodKey] = useState<AccountingPeriodKey>("this")
    const actions = { selectPeriod: (key: string) => setPeriodKey(key === "last" ? "last" : "this") }
    if (!data) return { props: null, on: actions }
    const period = data.periods[periodKey]
    const waitingTotal = data.waiting.count.live + data.waiting.count.simulated

    /** One money figure: live money (never added to simulated), then its count and the simulated part. */
    const measureOf = (id: string, measure: AccountingMeasure, unit: "countInvoices" | "countPayments") => ({
        id,
        term: t(`m${id}`),
        value: moneyOf(format, measure.vnd.live),
        hint: t(`m${id}Hint`),
        lines: [
            `${t("originLive")} · ${t(unit, { n: measure.count.live })}`,
            `${t("originSimulated")}: ${moneyOf(format, measure.vnd.simulated)} · ${t(unit, { n: measure.count.simulated })}`,
            `${t("sourceLabel")}: ${t(`m${id}Source`)}`,
        ],
        actionLabel: null,
        actionHref: null,
    })
    const weekMax = Math.max(1, ...period.weeks.map((week) => week.live + week.simulated))

    return {
        props: {
            title: t("overviewTitle"),
            intro: t("overviewIntro", { month: monthOf(format, period.fromIso) }),
            periodLabel: t("periodLabel"),
            periodItems: [
                { id: "this", label: t("periodThis") },
                { id: "last", label: t("periodLast") },
            ],
            selectedPeriod: periodKey,
            measures: [
                measureOf("Income", period.income, "countInvoices"),
                measureOf("Receivable", period.receivable, "countInvoices"),
                measureOf("Unmatched", period.unmatched, "countPayments"),
                {
                    id: "Waiting",
                    term: t("mWaiting"),
                    value: String(data.waiting.count.live),
                    hint: t("mWaitingHint"),
                    lines: [
                        t("originLive"),
                        `${t("originSimulated")}: ${data.waiting.count.simulated}`,
                        `${
                            data.waiting.knownVnd > 0
                                ? `${t("waitingAmount", { amount: moneyOf(format, data.waiting.knownVnd) })} · `
                                : ""
                        }${t("sourceLabel")}: ${t("mWaitingSource")}`,
                    ],
                    actionLabel: waitingTotal > 0 ? t("openQuestions") : null,
                    actionHref: waitingTotal > 0 ? agentHref("accounting", null, "workbench", "tab=questions") : null,
                },
            ],
            excludedNote: data.excludedTest > 0 ? t("excludedTest", { n: data.excludedTest }) : null,
            trendTitle: t("trendTitle"),
            trendIntro: t("trendIntro"),
            trendSource: `${t("sourceLabel")}: ${t("mIncomeSource")}`,
            weekMax,
            weeks: period.weeks.map((week) => ({
                id: week.startIso,
                label: dayOf(format, week.startIso, false),
                total: week.live + week.simulated,
                reading:
                    week.simulated > 0
                        ? `${moneyOf(format, week.live)} + ${moneyOf(format, week.simulated)} (${t("originSimulated")})`
                        : moneyOf(format, week.live),
            })),
        },
        on: actions,
    }
}
