import type { useTranslations } from "next-intl"
import type { usePaneCopy } from "@/hooks/paneFrame"
import type { ConnectionsHomeCopy } from "./types"

/** The translator of the Connections page. */
type ConnectionsCopy = ReturnType<typeof useTranslations<"connections">>

/** What the figures need to know about the counts. */
interface FigureCounts {
    readonly total: number
    readonly agentsTotal: number
}

/** The words of the Connected tab: the catalog texts, with the pager lines left as templates for the table to fill. */
export const connectionsCopyOf = (
    t: ConnectionsCopy,
    pane: ReturnType<typeof usePaneCopy>,
    counts: FigureCounts,
): ConnectionsHomeCopy => ({
    attentionHeading: t("attentionHeading"),
    figuresLabel: t("figuresLabel"),
    running: t("figureRunning"),
    runningMeta: t("figureRunningMeta", { count: counts.total }),
    waiting: t("figureWaiting"),
    waitingMeta: t("figureWaitingMeta"),
    needs: t("figureNeeds"),
    needsMeta: t("figureNeedsMeta"),
    agents: t("figureAgentsUse"),
    agentsMeta: t("figureAgentsUseMeta", { count: counts.agentsTotal }),
    allHeading: t("allHeading"),
    colConnection: t("colConnection"),
    colLastEvent: t("colLastEvent"),
    colAgent: t("colAgent"),
    lastEventNone: t("lastEventNone"),
    lastEventFailed: t("lastEventFailed"),
    agentNone: t("agentNone"),
    filterLabel: t("filterLabel"),
    moreFilters: pane.moreFilters,
    searchLabel: t("libSearch"),
    clearLabel: t("libClear"),
    noMatchTitle: pane.noMatchTitle,
    noMatchBody: pane.noMatchBody,
    clearFilters: pane.clearFilters,
    forbiddenBody: t("forbiddenBody"),
    emptyBody: t("connectedEmptyHint"),
    emptyAction: t("openLibrary"),
    errorBody: t("errorBody"),
    paging: {
        nav: t("connPageNav"),
        previous: t("connPagePrev"),
        next: t("connPageNext"),
        pageTemplate: String(t.raw("connPageLabel")),
        summaryTemplate: String(t.raw("connPageSummary")),
    },
})
