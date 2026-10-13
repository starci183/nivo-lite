"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { dayOf, moneyOf, monthOf } from "@/hooks/accounting"
import type { AccountingMeasure, AccountingPeriod, AccountingPeriodKey, AccountingWaiting } from "@/modules/types"
import { AccountingOverviewBase } from "./component"

/** The periods the owner can look at, the waiting work and where the questions are answered. */
interface AccountingOverviewProps {
    readonly periods: { readonly this: AccountingPeriod; readonly last: AccountingPeriod }
    readonly waiting: AccountingWaiting
    readonly excludedTest: number
    readonly questionsHref: string
}

/** The Period overview tab: the period choice lives here, the drawing in the pure half. */
export const AccountingOverview = (props: AccountingOverviewProps) => {
    const t = useTranslations("workbenchAccounting")
    const format = useFormatter()
    const [periodKey, setPeriodKey] = useState<AccountingPeriodKey>("this")
    const period = props.periods[periodKey]
    const waitingTotal = props.waiting.count.live + props.waiting.count.simulated

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

    return (
        <AccountingOverviewBase
            props={{
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
                        value: String(props.waiting.count.live),
                        hint: t("mWaitingHint"),
                        lines: [
                            t("originLive"),
                            `${t("originSimulated")}: ${props.waiting.count.simulated}`,
                            `${
                                props.waiting.knownVnd > 0
                                    ? `${t("waitingAmount", { amount: moneyOf(format, props.waiting.knownVnd) })} · `
                                    : ""
                            }${t("sourceLabel")}: ${t("mWaitingSource")}`,
                        ],
                        actionLabel: waitingTotal > 0 ? t("openQuestions") : null,
                        actionHref: waitingTotal > 0 ? props.questionsHref : null,
                    },
                ],
                excludedNote: props.excludedTest > 0 ? t("excludedTest", { n: props.excludedTest }) : null,
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
            }}
            on={{ selectPeriod: (key) => setPeriodKey(key === "last" ? "last" : "this") }}
        />
    )
}
