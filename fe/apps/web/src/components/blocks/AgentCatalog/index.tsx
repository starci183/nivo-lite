"use client"

import { useTranslations } from "next-intl"
import { useCatalogEntries, useConnectionNeedsCopy, useInstallAgent } from "@/hooks/installations"
import { isManager, useMember } from "@/hooks/member"
import { ALL_CATEGORIES, useCatalogView } from "@/hooks/modules"
import { useSlotLabels } from "@/hooks/slot"
import { AgentCatalogBase } from "./component"

/** The connected agent catalogue: reads the installed agents in the browser; search, category and status filters kept in the URL; install opens the new agent. */
export const AgentCatalog = () => {
    const t = useTranslations("modulesCore")
    const member = useMember()
    const { entries, categories, slot, reload } = useCatalogEntries()
    const slotLabels = useSlotLabels()
    const installing = useInstallAgent()
    const needs = useConnectionNeedsCopy()
    const isLoading = slot.isLoading === true
    const items = entries.map((entry) => ({
        key: entry.key,
        categoryKey: entry.categoryKey,
        installed: entry.installed,
        isEarly: entry.isEarly,
        searchText: entry.searchText,
        card: {
            name: entry.name,
            description: entry.description,
            points: entry.points,
            mascot: entry.mascot,
            isEarly: entry.isEarly,
            earlyLabel: t("earlyBadge"),
            earlyHint: t("earlyHint"),
            statusLabel: t(`status_${entry.status}`),
            statusTone: entry.statusTone,
            needs: { lines: needs.linesOf(entry.connectionNeeds), linkLabel: needs.linkLabel, href: needs.href },
            isLoading,
            openHref: entry.openHref,
            openLabel: t("openModule"),
            canInstall: isManager(member),
            installLabel: t("install"),
        },
    }))
    const view = useCatalogView(items, categories, isLoading)
    return (
        <AgentCatalogBase
            props={{
                searchLabel: t("filterSearch"),
                searchPlaceholder: t("filterSearchPlaceholder"),
                clearLabel: t("filterClear"),
                query: view.filters.query,
                categoryLabel: t("filterCategory"),
                categoryOptions: [
                    { id: ALL_CATEGORIES, label: t("filterCategoryAll") },
                    ...categories.map((category) => ({ id: category.key, label: category.label })),
                ],
                category: view.filters.category,
                statusLabel: t("filterStatus"),
                statusOptions: view.statusKeys.map((filter) => ({ value: filter, label: t(`filterStatus_${filter}`) })),
                status: view.filters.status,
                resultCount: t("resultCount", { count: view.shownCount, total: items.length }),
                groups: view.groups,
                emptyTitle: t("emptyTitle"),
                emptyHint: t("emptyHint"),
                emptyAction: view.filters.isFiltered ? t("emptyAction") : undefined,
                slot,
                slotLabels: { ...slotLabels(t("emptyTitle")), error: t("loadFailed") },
                busyKey: installing.busyKey,
                isLoading,
            }}
            on={{
                query: view.filters.setQuery,
                category: view.filters.setCategory,
                status: view.filters.setStatus,
                clear: view.filters.clear,
                retry: reload,
                install: (key) => {
                    const entry = entries.find((candidate) => candidate.key === key)
                    if (entry !== undefined) void installing.install(entry.key)
                },
            }}
        />
    )
}
