"use client"

import { useTranslations } from "next-intl"
import { useCatalogEntries, useInstallAgent } from "@/hooks/installations"
import type { CatalogRole } from "@/hooks/installations"
import { isManager, useMember } from "@/hooks/member"
import { ALL_CATEGORIES, useCatalogView } from "@/hooks/modules"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { AgentCatalogBase } from "./component"
import type { AgentCatalogData } from "./component"

/** The translator of the catalogue copy. */
type CatalogCopy = ReturnType<typeof useTranslations<"modulesCore">>

/** The state a role card shares with the whole catalogue. */
type RoleCardState = { readonly canInstall: boolean }

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
        openHref: role.openHref,
        detailsLabel: t("viewDetails"),
        detailsPointsTitle: t("detailsPoints"),
        closeLabel: t("detailsClose"),
        canInstall: state.canInstall,
        installLabel: t("install"),
    },
})

/** One fake role of the same shape as a real one: the skeleton reuses the ready tree. */
const placeholderRoleOf = (key: string): AgentCatalogData["roles"][number] => ({
    key,
    card: {
        name: "-",
        description: "-",
        points: ["-"],
        mascot: "",
        isEarly: false,
        earlyLabel: "-",
        earlyHint: "-",
        stateLabel: "-",
        isInstalled: false,
        openHref: null,
        detailsLabel: "-",
        detailsPointsTitle: "-",
        closeLabel: "-",
        canInstall: true,
        installLabel: "-",
    },
})

/** One fake installed agent of the same shape as a real one. */
const placeholderAgentOf = (key: string): AgentCatalogData["team"][number] => ({
    key,
    card: { name: "-", seed: key, avatarUrl: null, roleName: "-", statusLabel: "-", statusTone: "neutral", href: "#" },
})

const PLACEHOLDER: AgentCatalogData = {
    team: ["a", "b", "c"].map(placeholderAgentOf),
    roles: ["a", "b", "c"].map(placeholderRoleOf),
}

/** The connected agent catalogue: the installed agents, then the roles to add; search and group kept in the URL; install opens the new agent. */
export const AgentCatalog = () => {
    const t = useTranslations("modulesCore")
    const member = useMember()
    const { agents, roles, categories, slot, reload } = useCatalogEntries()
    const slotLabels = useSlotLabels()
    const installing = useInstallAgent()
    const items = roles.map((role) => roleItemOf(role, t, { canInstall: isManager(member) }))
    const view = useCatalogView(items, categories, slot.isLoading === true)
    return (
        <AgentCatalogBase
            props={{
                yoursTitle: t("yoursTitle"),
                yoursEmptyTitle: t("yoursEmptyTitle"),
                yoursEmptyHint: t("yoursEmptyHint"),
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
                emptyTitle: t("emptyTitle"),
                emptyHint: t("emptyHint"),
                emptyAction: view.filters.isFiltered ? t("emptyAction") : undefined,
                slot: mapSlot(slot, (): AgentCatalogData => ({
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
                        },
                    })),
                    roles: view.cards,
                })),
                placeholder: PLACEHOLDER,
                slotLabels: { ...slotLabels(t("emptyTitle")), error: t("loadFailed") },
                busyKey: installing.busyKey,
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
