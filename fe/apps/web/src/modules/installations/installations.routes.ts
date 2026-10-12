import type { ModuleKey } from "@/modules/catalog"

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
    const base = installationId ? `/agents/${module}/${installationId}` : `/agents/${module}`
    const path = tab === "setup" ? base : `${base}/${tab}`
    return query ? `${path}?${query}` : path
}

/** The list of the instances of a type (/agents/<type>?list=1): shown even when there is only one, so adding a new one is always reachable. */
export const agentListHref = (module: ModuleKey): string => `/agents/${module}?list=1`
