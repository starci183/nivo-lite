"use client"

import { useTranslations } from "next-intl"
import type { RunsTableCopy } from "@/modules/types"

/** The words of the table of runs, shared by the runs of an agent and the runs of one workflow. */
export const useRunsTableCopy = (): RunsTableCopy => {
    const t = useTranslations("agentRuns")
    return {
        statusFilter: t("statusFilter"),
        searchLabel: t("searchLabel"),
        searchPlaceholder: t("searchPlaceholder"),
        searchClear: t("searchClear"),
        sourceFilter: t("sourceFilter"),
        workflowFilter: t("workflowsTitle"),
        run: t("colId"),
        workflow: t("colWorkflow"),
        started: t("colStarted"),
        duration: t("colDuration"),
        result: t("colResult"),
        empty: t("empty"),
        emptyFiltered: t("emptyFiltered"),
        pagerLabel: t("pagerLabel"),
        previous: t("pagerPrevious"),
        next: t("pagerNext"),
        pageLabel: (page) => t("pagerPage", { page }),
        summary: (from, to, total) => t("pagerSummary", { from, to, total }),
    }
}
