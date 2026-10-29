"use client"

import { useFormatter, useTranslations } from "next-intl"
import {
    TOP_WAITING,
    departmentsOf,
    exceptionChipsOf,
    exceptionTotalOf,
    historyRowsOf,
    waitingItemsOf,
} from "@/hooks/overviewGov"
import { useOverviewData, useOverviewGovernance } from "@/hooks/overview"
import { goalLinesOf, statusRowsOf } from "@/hooks/overviewResults"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { OverviewGovernanceBase } from "./component"

/** The five governance blocks of the overview with their copy and figures resolved in the browser. */
export const OverviewGovernance = () => {
    const t = useTranslations("overview")
    const g = useTranslations("governance")
    const format = useFormatter()
    const data = useOverviewGovernance()
    const { failed } = useOverviewData()
    if (data === undefined) {
        if (failed) return null
        return (
            <OverviewGovernanceBase
                props={{
                    unavailable: t("govUnavailable"),
                    resultsTitle: t("resultsTitle"),
                    figures: null,
                    isSkeleton: true,
                }}
            />
        )
    }
    const { governance } = data
    const pending = governance.pendingDecisions
    const exceptionTotal = exceptionTotalOf(governance)
    const excluded = governance.status.excludedTestRecords
    return (
        <OverviewGovernanceBase
            props={{
                unavailable: t("govUnavailable"),
                resultsTitle: t("resultsTitle"),
                isSkeleton: false,
                figures: {
                    summary: {
                        title: t("sumTitle"),
                        motto: t("motto"),
                        sentence: t("sumSentence", {
                            done: governance.efficiency.autoDone7d,
                            asked: governance.efficiency.askedHuman7d,
                        }),
                        median:
                            governance.efficiency.medianDecisionMinutes === null
                                ? t("sumMedianNone")
                                : t("sumMedian", { n: Math.round(governance.efficiency.medianDecisionMinutes) }),
                        chatHref: CONSOLE_ROUTES.chat,
                        departments: departmentsOf(t, g, format, governance),
                    },
                    results: {
                        title: t("resultsTitle"),
                        intro: t("resultsIntro"),
                        rows: statusRowsOf(t, format, governance),
                        service: t("resultsService"),
                        goals: goalLinesOf(t, format, governance),
                        goalHref: CONSOLE_ROUTES.authority,
                        goalSetLabel: t("goalSet"),
                        testNote:
                            excluded > 0
                                ? t("resultsTestExcluded", { n: format.number(excluded) })
                                : t("resultsTestNone"),
                    },
                    waiting: {
                        title: t("waitingTitle"),
                        openLabel: pending > 0 ? t("waitingOpen") : null,
                        chatHref: CONSOLE_ROUTES.chat,
                        none: t("waitingNone"),
                        count: pending === 1 ? t("waitingCountOne") : t("waitingCount", { n: pending }),
                        items: pending === 0 ? [] : waitingItemsOf(g, data.waiting),
                        more: pending > TOP_WAITING ? t("waitingMore", { n: pending }) : null,
                        source: t("waitingSource"),
                    },
                    exceptions: {
                        title: t("exceptionsTitle"),
                        none: t("exceptionsNone"),
                        total: exceptionTotal === 0 ? null : t("exceptionsTotal", { n: exceptionTotal }),
                        chips: exceptionChipsOf(t, g, governance),
                        source: t("exceptionsSource"),
                    },
                    history: {
                        title: t("historyTitle"),
                        allLabel: t("historyAll"),
                        allHref: CONSOLE_ROUTES.decisions,
                        empty: t("historyEmpty"),
                        rows: historyRowsOf(g, format, governance),
                        source: t("historySource"),
                    },
                },
            }}
        />
    )
}
