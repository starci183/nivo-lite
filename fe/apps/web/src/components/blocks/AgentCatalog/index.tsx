"use client"

import { useTranslations } from "next-intl"
import { useCatalogEntries, useInstallAgent } from "@/hooks/installations"
import type { CatalogRole } from "@/hooks/installations"
import { isManager, useMember } from "@/hooks/member"
import { ALL_CATEGORIES, useCatalogView } from "@/hooks/modules"
import { useSlotLabels } from "@/hooks/slot"
import { AgentCatalogBase } from "./component"

/** The translator of the catalogue copy. */
type CatalogCopy = ReturnType<typeof useTranslations<"modulesCore">>

/** The state a role card shares with the whole catalogue. */
type RoleCardState = { readonly isLoading: boolean; readonly canInstall: boolean }

/** One role of the catalogue as the view filters it and the card draws it. */
const roleItemOf = (role: CatalogRole, t: CatalogCopy, state: RoleCardState) => ({
    key: role.key,
    categoryKey: role.categoryKey,
    searchText: role.searchText,
    card: {
        name: role.name,
        description: role.description,
        points: role.points,
        mascot: role.mascot,
        isEarly: role.isEarly,
        earlyLabel: t("earlyBadge"),
        earlyHint: t("earlyHint"),
        stateLabel: role.installed ? t("roleInstalled") : t("roleNotInstalled"),
        isInstalled: role.installed,
        isLoading: state.isLoading,
        openHref: role.openHref,
        detailsLabel: t("viewDetails"),
        detailsPointsTitle: t("detailsPoints"),
        closeLabel: t("detailsClose"),
        canInstall: state.canInstall,
        installLabel: t("install"),
    },
})

/** The connected agent catalogue: the installed agents, then the roles to add; search and group kept in the URL; install opens the new agent. */
export const AgentCatalog = () => {
    const t = useTranslations("modulesCore")
    const member = useMember()
    const { agents, roles, categories, slot, reload } = useCatalogEntries()
    const slotLabels = useSlotLabels()
    const installing = useInstallAgent()
    const isLoading = slot.isLoading === true
    const items = roles.map((role) => roleItemOf(role, t, { isLoading, canInstall: isManager(member) }))
    const view = useCatalogView(items, categories, isLoading)
    return (
        <AgentCatalogBase
            props={{
                yoursTitle: t("yoursTitle"),
                yoursEmptyTitle: t("yoursEmptyTitle"),
                yoursEmptyHint: t("yoursEmptyHint"),
                team: agents.map((agent) => ({
                    key: agent.id,
                    card: {
                        name: agent.name,
                        seed: agent.seed,
                        avatarUrl: agent.avatarUrl,
                        roleName: agent.roleName,
                        statusLabel: t(`lifecycle_${agent.lifecycle}`),
                        statusTone: agent.tone,
                        href: agent.href,
                        isLoading: false,
                    },
                })),
                addTitle: t("addTitle"),
                searchLabel: t("filterSearch"),
                searchPlaceholder: t("filterSearchPlaceholder"),
                clearLabel: t("filterClear"),
                query: view.filters.query,
                categoryLabel: t("filterCategory"),
                categoryOptions: [
                    { value: ALL_CATEGORIES, label: t("filterCategoryAll") },
                    ...categories.map((category) => ({ value: category.key, label: category.label })),
                ],
                category: view.filters.category,
                roles: view.cards,
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
                category: (value) => view.filters.setCategory(value),
                clear: view.filters.clear,
                retry: reload,
                install: (key) => {
                    const role = roles.find((candidate) => candidate.key === key)
                    if (role !== undefined) void installing.install(role.key)
                },
            }}
        />
    )
}
