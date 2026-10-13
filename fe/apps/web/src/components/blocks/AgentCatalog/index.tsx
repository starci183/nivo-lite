"use client"

import { useTranslations } from "next-intl"
import { ALL_CATEGORIES, useCatalogView, useInstallAgent } from "@/hooks/modules"
import { installAgent } from "@/lib/module-actions"
import { AgentCatalogBase } from "./component"
import type { AgentCatalogBoardCard } from "./component"

/** One agent of the catalogue as the page prepared it, in the reader language. */
type AgentCatalogItem = {
    readonly key: string
    readonly categoryKey: string
    /** The name, description and points folded for matching, in both languages. */
    readonly searchText: string
    readonly installed: boolean
    readonly isEarly: boolean
    readonly card: AgentCatalogBoardCard["card"]
}

/** What the catalogue page hands the block. */
export type AgentCatalogProps = {
    readonly items: ReadonlyArray<AgentCatalogItem>
    readonly categories: ReadonlyArray<{ readonly key: string; readonly label: string }>
    /** The status is not known yet: the filters wait and the cards show skeleton statuses. */
    readonly isLoading?: boolean
}

/** The connected agent catalogue: search, category and status filters kept in the URL, and the install that opens the new agent. */
export const AgentCatalog = (props: AgentCatalogProps) => {
    const t = useTranslations("modulesCore")
    const isLoading = props.isLoading === true
    const view = useCatalogView(props.items, props.categories, isLoading)
    const installing = useInstallAgent(installAgent)
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
                    ...props.categories.map((category) => ({ id: category.key, label: category.label })),
                ],
                category: view.filters.category,
                statusLabel: t("filterStatus"),
                statusOptions: view.statusKeys.map((filter) => ({ value: filter, label: t(`filterStatus_${filter}`) })),
                status: view.filters.status,
                resultCount: t("resultCount", { count: view.shownCount, total: props.items.length }),
                groups: view.groups,
                emptyTitle: t("emptyTitle"),
                emptyHint: t("emptyHint"),
                emptyAction: view.filters.isFiltered ? t("emptyAction") : undefined,
                errorTitle: t("installFailed"),
                error: installing.refusal === "" ? undefined : installing.refusal,
                busyKey: installing.busyKey === "" ? null : installing.busyKey,
                isLoading,
            }}
            on={{
                query: view.filters.setQuery,
                category: view.filters.setCategory,
                status: view.filters.setStatus,
                clear: view.filters.clear,
                install: installing.install,
            }}
        />
    )
}
