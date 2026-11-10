"use client"

import { useCatalogEntries } from "@/hooks/installations"
import { useCatalogFilters } from "@/hooks/modules"
import type { DataSlot } from "@/modules/types"
import { useAgentRoles, type AgentRolesView } from "./useAgentRoles"
import { useAgentCardActions, type AgentCardActions } from "./useAgentCardActions"
import { useAgentTable, type AgentTableView } from "./useAgentTable"

/** Everything the agent catalogue draws and calls. */
export interface AgentCatalogView {
    readonly slot: DataSlot<boolean>
    readonly reload: () => void
    readonly table: AgentTableView
    readonly roles: AgentRolesView
    readonly cardActions: AgentCardActions
}

/** The agent catalogue: the installed agents with what each may use and read, and the roles to add; one read each, one URL filter. */
export const useAgentCatalog = (): AgentCatalogView => {
    const catalog = useCatalogEntries()
    const filters = useCatalogFilters(catalog.categories.map((category) => category.key))
    return {
        slot: catalog.slot,
        reload: catalog.reload,
        table: useAgentTable(catalog.agents, filters),
        roles: useAgentRoles(catalog, filters),
        cardActions: useAgentCardActions(),
    }
}
