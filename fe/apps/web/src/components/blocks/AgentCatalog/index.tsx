"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { useOpenAgentCreate } from "@/hooks/agentCreate"
import { navigation } from "@/modules/i18n"
import { useAgentRemovalImpact } from "@/hooks/agentSettings"
import { useAgentCatalog, type AgentCatalogRoleEntry, type AgentCatalogRow } from "@/hooks/agentCatalog"
import { mapSlot, useSlotLabels } from "@/hooks/slot"
import { AGENT_ROLES_ANCHOR } from "@/modules/routes"
import { AgentCatalogBase, type AgentCatalogBaseProps } from "./component"

/** One fake role of the same shape as a real one: the skeleton reuses the ready tree. */
const placeholderRoleOf = (key: string): AgentCatalogRoleEntry => ({
    key,
    card: {
        name: "-",
        description: "-",
        moduleKey: "chatbot",
        stateLabel: "-",
        isInstalled: false,
        needsLabel: "-",
        canInstall: true,
        installLabel: "-",
    },
})

/** One fake installed agent of the same shape as a real one. */
const placeholderAgentOf = (key: string): AgentCatalogRow => ({
    key,
    name: "-",
    roleKey: "chatbot",
    picture: null,
    isInitials: false,
    seed: key,
    subtitle: "-",
    grants: [{ id: key, logo: null, label: "-", brand: "-" }],
    roleName: "-",
    missingLabels: [],
    tasks7d: 0,
    waiting: 0,
    canAddSame: false,
    liveAction: "none",
    menuLabel: "-",
    statusLabel: "-",
    statusTone: "neutral",
    href: "#",
    isMissingConnection: false,
    hasWaitingFacts: false,
    searchText: "",
})

const PLACEHOLDER: AgentCatalogBaseProps["props"]["placeholder"] = {
    rows: ["a", "b", "c"].map((key) => placeholderAgentOf(key)),
    hasFilters: false,
    roles: ["a", "b", "c"].map((key) => placeholderRoleOf(key)),
}

/**
 * The connected agent catalogue: the installed agents as one table (what each may use, what it reads, whether it runs; chips and
 * search narrow it), then the roles to add by group; the group and search stay in the URL, install opens the new agent, and an
 * installed role of several agents opens its list to add another.
 */
export const AgentCatalog = () => {
    const t = useTranslations("agentCatalog")
    const slotLabels = useSlotLabels()
    const router = navigation.useRouter()
    const openCreate = useOpenAgentCreate()
    const tc = useTranslations("modulesCore")
    const { slot, reload, table, roles, cardActions } = useAgentCatalog()
    const [removing, setRemoving] = useState<{ readonly key: string; readonly name: string } | null>(null)
    const impact = useAgentRemovalImpact(removing?.key ?? null)
    return (
        <AgentCatalogBase
            props={{
                yoursTitle: t("yoursTitle"),
                filterLabel: t("filterLabel"),
                filters: table.options,
                filter: table.filter,
                searchLabel: t("searchLabel"),
                searchPlaceholder: t("searchPlaceholder"),
                searchClear: t("searchClear"),
                query: table.query,
                openLabel: t("cardOpen"),
                addLabel: t("cardAdd"),
                pauseLabel: t("cardPause"),
                resumeLabel: t("cardResume"),
                removeLabel: t("cardRemove"),
                removing:
                    removing === null
                        ? null
                        : { ...removing, title: tc("removeDialogTitle", { name: removing.name }) },
                removeImpact: impact.lines,
                removeImpactLabels: impact.labels,
                removeConfirm: tc("removeConfirm"),
                removeCancel: tc("removeCancel"),
                isBusy: cardActions.isBusy,
                tasksLabel: t("cardTasks"),
                waitingLabel: t("cardWaiting"),
                noCount: t("cardNoCount"),
                emptyTitle: t("emptyTitle"),
                emptyHint: t("emptyHint"),
                emptyAction: t("emptyAction"),
                noAgentsTitle: t("noAgentsTitle"),
                noAgentsHint: t("noAgentsHint"),
                addTitle: t("addTitle"),
                addId: AGENT_ROLES_ANCHOR,
                categoryLabel: t("categoryLabel"),
                categoryOptions: roles.options,
                category: roles.category,
                rolesEmptyTitle: t("rolesEmptyTitle"),
                rolesEmptyHint: t("rolesEmptyHint"),
                slot: mapSlot(slot, () => ({ rows: table.rows, hasFilters: table.hasFilters, roles: roles.entries })),
                placeholder: PLACEHOLDER,
                slotLabels: { ...slotLabels(t("emptyTitle")), error: t("loadFailed") },
                busyKey: roles.busyKey,
            }}
            on={{
                filter: table.setFilter,
                query: table.setQuery,
                clear: table.clear,
                category: roles.setCategory,
                retry: reload,
                retryImpact: impact.retry,
                install: roles.install,
                open: (href) => router.push(href),
                add: openCreate,
                setLive: (id, live) => void cardActions.setLive(id, live),
                askRemove: setRemoving,
                confirmRemove: (id) => {
                    setRemoving(null)
                    void cardActions.remove(id)
                },
            }}
        />
    )
}
