"use client"

import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { useConnectionsList, visibleRowsOf } from "@/hooks/connectionsPanes"
import { usePaneCopy } from "@/hooks/paneFrame"
import { providerLogoOf, providerNameOf, useProviderTemplateCandidates } from "@/hooks/providerRights"
import { useSlotLabels } from "@/hooks/slot"
import { navigation } from "@/modules/i18n"
import { CONSOLE_ROUTES, workspaceHref } from "@/modules/routes"
import { ConnectionsHomeBase } from "./component"
import { useWorkspaceId } from "@/hooks/workspaces"

/**
 * The Connected tab of the Connections page: reads the workspace's connections, keeps the search and the filter of the list, and
 * sends each action and row to the connection's own page.
 */
export const ConnectionsHome = () => {
    const t = useTranslations("connections")
    const tRights = useTranslations("agentRights")
    const pending = useProviderTemplateCandidates()
    const pane = usePaneCopy()
    const locale = useLocale()
    const router = navigation.useRouter()
    const workspaceId = useWorkspaceId()
    const labels = useSlotLabels()
    const list = useConnectionsList()
    const [text, setText] = useState("")
    const [filter, setFilter] = useState("all")
    const view = "items" in list.slot ? list.slot.items : undefined
    const figures = view?.figures
    return (
        <ConnectionsHomeBase
            props={{
                copy: {
                    attentionHeading: t("attentionHeading"),
                    figuresLabel: t("figuresLabel"),
                    running: t("figureRunning"),
                    runningMeta: t("figureRunningMeta", { count: figures?.total ?? 0 }),
                    waiting: t("figureWaiting"),
                    waitingMeta: t("figureWaitingMeta"),
                    needs: t("figureNeeds"),
                    needsMeta: t("figureNeedsMeta"),
                    agents: t("figureAgentsUse"),
                    agentsMeta: t("figureAgentsUseMeta", { count: figures?.agentsTotal ?? 0 }),
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
                        page: (page: number) => t("connPageLabel", { page }),
                        summary: (from: number, to: number, total: number) => t("connPageSummary", { from, to, total }),
                    },
                },
                locale,
                slot: list.slot,
                labels: labels(t("connectedEmpty")),
                rows: view === undefined ? [] : visibleRowsOf(view.rows, filter, text),
                filter,
                text,
                pending: pending.rows.map((row) => {
                    const provider = providerNameOf(row.provider)
                    const agents = new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(
                        row.candidates.map((agent) => agent.agentName),
                    )
                    return {
                        id: row.provider,
                        title: tRights("pendingTitle", { provider, agents }),
                        body: tRights("pendingBody", { provider }),
                        name: provider,
                        logo: providerLogoOf(row.provider),
                        laterLabel: tRights("pendingLater"),
                        attachLabel: tRights("pendingAttach"),
                    }
                }),
            }}
            on={{
                later: (id) => pending.dismiss(id),
                attachByTemplate: (id) => void pending.attach(id),
                goTo: (href) => router.push(href),
                openLibrary: () => router.push(workspaceHref(workspaceId, `${CONSOLE_ROUTES.connections}?tab=library`)),
                retry: list.retry,
                filter: setFilter,
                text: setText,
                clearFilters: () => {
                    setText("")
                    setFilter("all")
                },
            }}
        />
    )
}
