"use client"

import { useTranslations } from "next-intl"
import { useSearchParams } from "next/navigation"
import { CONNECTION_PAGE_TABS, CONNECTION_PAGE_VIEW_PARAM, connectionPageTabOf } from "@/modules/connection-page"
import { navigation } from "@/modules/i18n"
import type { ConnectionPageTabId, ConnectionPageTabsView } from "@/modules/types"

/** The catalog key of each tab's name. */
const TAB_KEYS: Readonly<Record<ConnectionPageTabId, string>> = {
    overview: "pageTabOverview",
    events: "pageTabEvents",
    agents: "pageTabAgents",
    settings: "pageTabSettings",
}

/**
 * The tabs of a connection page (Overview, Events, Agents with its count, Settings) as links of the page's own address, and the one
 * the address opens, so a refresh and a shared link keep it. `extra` keeps other query parameters of the page (the generic page's id).
 * `labels` renames a tab for a page whose first section is not an overview (the Google account page says "Services"); the id stays.
 */
export const useConnectionPageTabs = (
    agentCount: number | undefined,
    extra?: Readonly<Record<string, string>>,
    labels?: Readonly<Partial<Record<ConnectionPageTabId, string>>>,
): ConnectionPageTabsView => {
    const t = useTranslations("connections")
    const pathname = navigation.usePathname()
    const params = useSearchParams()
    const selected = connectionPageTabOf(params.get(CONNECTION_PAGE_VIEW_PARAM))
    const hrefOf = (id: ConnectionPageTabId): string => {
        const query = new URLSearchParams(extra)
        if (id !== "overview") query.set(CONNECTION_PAGE_VIEW_PARAM, id)
        const text = query.toString()
        return text === "" ? pathname : `${pathname}?${text}`
    }
    return {
        label: t("pageTabsLabel"),
        selected,
        items: CONNECTION_PAGE_TABS.map((id) => ({
            id,
            label: labels?.[id] ?? t(TAB_KEYS[id]),
            href: hrefOf(id),
            ...(id === "agents" && agentCount !== undefined ? { count: agentCount } : {}),
        })),
        hrefOf,
    }
}
