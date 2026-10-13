import type { ModuleKey } from "@/modules/catalog"

/** The agents area: the catalogue of agents. */
export const AGENTS_ROUTE = "/agents"

/** A tab of one agent instance. */
export type AgentTab = "setup" | "workbench" | "settings"

/**
 * The route of an agent instance: /agents/<type>/<installationId>[/workbench|/settings][?query]. Without an installation id it is the
 * type-level URL (/agents/<type>[/tab]), which redirects to the only instance, or to the instance that owns `?focus=`, or to the list.
 */
export const agentHref = (
    module: ModuleKey,
    installationId: string | null | undefined,
    tab: AgentTab = "setup",
    query?: string,
): string => {
    const base = installationId ? `${AGENTS_ROUTE}/${module}/${installationId}` : `${AGENTS_ROUTE}/${module}`
    const path = tab === "setup" ? base : `${base}/${tab}`
    return query ? `${path}?${query}` : path
}

/** The list of the instances of a type (/agents/<type>?list=1): shown even when there is only one, so adding a new one is always reachable. */
export const agentListHref = (module: ModuleKey): string => `${AGENTS_ROUTE}/${module}?list=1`
