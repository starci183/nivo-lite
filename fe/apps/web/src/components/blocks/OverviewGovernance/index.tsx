import { getFormatter, getTranslations } from "next-intl/server"
import {
    TOP_WAITING,
    departmentsOf,
    exceptionChipsOf,
    exceptionTotalOf,
    historyRowsOf,
    waitingItemsOf,
} from "@/hooks/overviewGov"
import { goalLinesOf, statusRowsOf } from "@/hooks/overviewResults"
import type { GovernanceWithStatus } from "@/lib/flow-queries"
import type { WorkItemView } from "@/lib/flow-types"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { OverviewGovernanceBase } from "./component"

/** The governance figures, or null when the flow data could not be read, and the decisions waiting for the owner. */
interface OverviewGovernanceProps {
    readonly governance: GovernanceWithStatus | null
    /** Work items waiting for a decision, oldest first (test runs already removed). */
    readonly waiting: ReadonlyArray<WorkItemView>
}

/** The five governance blocks of the overview with their copy and figures resolved on the server. */
export const OverviewGovernance = async (props: OverviewGovernanceProps) => {
    const [t, g, format] = await Promise.all([
        getTranslations("overview"),
        getTranslations("governance"),
        getFormatter(),
    ])
    const governance = props.governance
    if (governance === null) {
        return (
            <OverviewGovernanceBase
                props={{ unavailable: t("govUnavailable"), resultsTitle: t("resultsTitle"), figures: null }}
            />
        )
    }
    const pending = governance.pendingDecisions
    const exceptionTotal = exceptionTotalOf(governance)
    const excluded = governance.status.excludedTestRecords
    return (
        <OverviewGovernanceBase
            props={{
                unavailable: t("govUnavailable"),
                resultsTitle: t("resultsTitle"),
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
                        items: pending === 0 ? [] : waitingItemsOf(g, props.waiting),
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
