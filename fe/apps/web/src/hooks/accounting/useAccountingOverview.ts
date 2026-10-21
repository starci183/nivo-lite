"use client"

import type { AccountingWorkbenchData, AccountingMeasure, AccountingPeriodKey } from "@/modules/types"
import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { dayOf, moneyOf, monthOf, type AccountingFormat, type AccountingTranslator } from "@/modules/utils"
import { agentHref } from "@/modules/installations"
import { CONSOLE_ROUTES } from "@/modules/routes"

/** One money figure: the money, its count and where it comes from. */
const measureOf = (
    t: AccountingTranslator,
    format: AccountingFormat,
    id: string,
    measure: AccountingMeasure,
    unit: "countInvoices" | "countPayments",
) => ({
    id,
    term: t(`m${id}`),
    value: moneyOf(format, measure.vnd),
    hint: t(`m${id}Hint`),
    lines: [t(unit, { n: measure.count }), `${t("sourceLabel")}: ${t(`m${id}Source`)}`],
    actionLabel: null,
    actionHref: null,
})

/** Money in that is not matched comes from the payment connector: without one it says so and links to it, never 0. */
const unmatchedOf = (
    t: AccountingTranslator,
    format: AccountingFormat,
    measure: AccountingMeasure,
    creditsSource: string | null,
) =>
    creditsSource === null
        ? {
              id: "Unmatched",
              term: t("mUnmatched"),
              value: t("notConnected"),
              hint: t("mUnmatchedHint"),
              lines: [t("notConnectedHint")],
              actionLabel: t("openConnections"),
              actionHref: CONSOLE_ROUTES.connections,
          }
        : {
              ...measureOf(t, format, "Unmatched", measure, "countPayments"),
              lines: [
                  t("countPayments", { n: measure.count }),
                  `${t("sourceLabel")}: ${t("mUnmatchedSource", { source: creditsSource })}`,
              ],
          }

/** The Period overview tab: the period choice lives here, the drawing in the pure half. */
export const useAccountingOverview = (data: AccountingWorkbenchData | undefined) => {
    const t = useTranslations("workbenchAccounting")
    const format = useFormatter()
    const [periodKey, setPeriodKey] = useState<AccountingPeriodKey>("this")
    const actions = { selectPeriod: (key: string) => setPeriodKey(key === "last" ? "last" : "this") }
    if (!data) return { props: null, on: actions }
    const period = data.periods[periodKey]
    const waitingTotal = data.waiting.count

    const weekMax = Math.max(1, ...period.weeks.map((week) => week.vnd))

    const waitingAmount =
        data.waiting.knownVnd > 0 ? `${t("waitingAmount", { amount: moneyOf(format, data.waiting.knownVnd) })} · ` : ""
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
                measureOf(t, format, "Income", period.income, "countInvoices"),
                measureOf(t, format, "Receivable", period.receivable, "countInvoices"),
                unmatchedOf(t, format, period.unmatched, data.creditsSource),
                {
                    id: "Waiting",
                    term: t("mWaiting"),
                    value: String(data.waiting.count),
                    hint: t("mWaitingHint"),
                    lines: [`${waitingAmount}${t("sourceLabel")}: ${t("mWaitingSource")}`],
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
                total: week.vnd,
                reading: moneyOf(format, week.vnd),
            })),
        },
        on: actions,
    }
}
