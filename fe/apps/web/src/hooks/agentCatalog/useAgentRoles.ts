"use client"

import { useTranslations } from "next-intl"
import { useOpenAgentCreate } from "@/hooks/agentCreate"
import type { CatalogRole } from "@/hooks/installations"
import { isManager, useMember } from "@/hooks/member"
import { ALL_CATEGORIES, type CatalogFilters } from "@/hooks/modules"
import type { AgentCatalogRoleEntry, CatalogFilterOption } from "@/modules/agentCatalog"
import { needsLabelOf, type CatalogCopy } from "./agentCatalog.shared"

/** The roles and groups of the catalogue the roles section reads. */
interface RolesSource {
    readonly roles: ReadonlyArray<CatalogRole>
    readonly categories: ReadonlyArray<{ readonly key: string; readonly label: string }>
}

/** What the roles section draws and calls. */
export interface AgentRolesView {
    /** The role cards of the group the chip keeps. */
    readonly entries: ReadonlyArray<AgentCatalogRoleEntry>
    /** The group chips, the first keeps every role. */
    readonly options: ReadonlyArray<CatalogFilterOption>
    readonly category: string
    readonly setCategory: (value: string) => void
    /** The role being installed, if any. */
    readonly busyKey: string | null
    readonly install: (key: string) => void
}

/** One role of the catalogue as its card draws it. */
const roleEntryOf = (role: CatalogRole, t: CatalogCopy, canInstall: boolean): AgentCatalogRoleEntry => ({
    key: role.key,
    card: {
        name: role.name,
        description: role.description,
        moduleKey: role.key,
        stateLabel: role.installed ? t("roleInstalled", { count: role.installedCount }) : t("roleNotInstalled"),
        isInstalled: role.installed,
        needsLabel: needsLabelOf(role.providers, t),
        canInstall,
        installLabel: role.addHref === null ? t("roleCreate") : t("roleAddAnother"),
    },
})

/** The roles to add, grouped by the category of the URL; a role card opens the create dialog for that role. */
export const useAgentRoles = (catalog: RolesSource, filters: CatalogFilters): AgentRolesView => {
    const t = useTranslations("agentCatalog")
    const member = useMember()
    const openCreate = useOpenAgentCreate()
    const kept = catalog.roles.filter(
        (role) => filters.category === ALL_CATEGORIES || role.categoryKey === filters.category,
    )
    return {
        entries: kept.map((role) => roleEntryOf(role, t, isManager(member))),
        options: [
            { id: ALL_CATEGORIES, label: t("categoryAll"), count: catalog.roles.length },
            ...catalog.categories.map((category) => ({
                id: category.key,
                label: category.label,
                count: catalog.roles.filter((role) => role.categoryKey === category.key).length,
            })),
        ],
        category: filters.category,
        setCategory: (value) => filters.setCategory(value),
        busyKey: null,
        install: (key) => {
            const role = catalog.roles.find((candidate) => candidate.key === key)
            if (role !== undefined) openCreate(role.key)
        },
    }
}
