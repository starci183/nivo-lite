import type { useTranslations } from "next-intl"
import type { OverviewManagerCopy } from "./types"

/** The translator of the `overview` catalog. */
type OverviewTranslator = ReturnType<typeof useTranslations<"overview">>

/** The days the period spans, written as the header says them. */
interface PeriodRange {
    readonly from: string
    readonly to: string
}

/** The words of the owner's overview in the reader's language. */
export const managerCopyOf = (t: OverviewTranslator, range: PeriodRange): OverviewManagerCopy => {
    return {
        title: t("title"),
        description: t("description", { from: range.from, to: range.to }),
        periodLabel: t("periodLabel"),
        periods: {
            today: t("periodToday"),
            last_7_days: t("period7"),
            last_30_days: t("period30"),
            this_month: t("periodMonth"),
        },
        exportLabel: t("exportReport"),
        kpisLabel: t("kpisLabel"),
        forbiddenBody: t("forbiddenBody"),
        agentsOpen: t("agentsOpen"),
        approvals: {
            title: t("approvalsTitle"),
            more: t("approvalsMore"),
            emptyTitle: t("approvalsEmptyTitle"),
            emptyBody: t("approvalsEmptyBody"),
        },
        savings: { title: t("savingsTitle"), hoursNote: t("savingsHoursNote"), help: t("savingsHelp") },
        agents: {
            title: t("agentsTitle"),
            note: t("agentsNote"),
            open: t("agentsOpen"),
            agent: t("agentsColumnAgent"),
            tasks: t("agentsColumnTasks"),
            auto: t("agentsColumnAuto"),
            waiting: t("agentsColumnWaiting"),
            errors: t("agentsColumnErrors"),
            response: t("agentsColumnResponse"),
            saved: t("agentsColumnSaved"),
            credits: t("agentsColumnCredits"),
            emptyTitle: t("agentsEmptyTitle"),
            emptyBody: t("agentsEmptyBody"),
        },
    }
}
