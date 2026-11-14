import type { ModuleKey } from "@/modules/catalog"
import { AGENTS_ROUTE } from "@/modules/routes"

/** A tab of one agent instance. */
export type AgentTab = "workbench" | "work" | "graph" | "workflows" | "chat" | "connections" | "knowledge" | "setup"

/**
 * The route of an agent instance: /agents/<type>/<installationId>[/workbench|/work|/chat|/connections|/knowledge|/setup][?query].
 * Without a tab it is the landing of the instance, which opens Setup for an agent that is not set up and the workbench otherwise.
 * Without an installation id it is the type-level URL (/agents/<type>[/tab]), which redirects to the only instance, or to the instance
 * that owns `?focus=`, or to the list.
 */
export const agentHref = (
    module: ModuleKey,
    installationId: string | null | undefined,
    tab?: AgentTab,
    query?: string,
): string => {
    const base = installationId ? `${AGENTS_ROUTE}/${module}/${installationId}` : `${AGENTS_ROUTE}/${module}`
    const path = tab === undefined ? base : `${base}/${tab}`
    return query ? `${path}?${query}` : path
}

/** The list of the instances of a type (/agents/<type>?list=1): shown even when there is only one, so adding a new one is always reachable. */
export const agentListHref = (module: ModuleKey): string => `${AGENTS_ROUTE}/${module}?list=1`

/** Options of a workbench deep link. */
interface WorkbenchHrefOptions {
    readonly tab?: string
    readonly focus?: string
    readonly installationId?: string | null
}

/** A workbench deep link, optionally on a tab, focused on one record, or on one installed instance (`?tab=` and `?focus=`). */
export const workbenchPath = (module: ModuleKey, opts: WorkbenchHrefOptions = {}): string => {
    const query = new URLSearchParams()
    if (opts.tab) query.set("tab", opts.tab)
    if (opts.focus) query.set("focus", opts.focus)
    return agentHref(module, opts.installationId ?? null, "workbench", query.toString())
}

/** The query word that carries a short notice across a redirect to an agent tab: staff sent from Setup to the workbench. */
export const OWNER_SETUP_NOTICE = "owner-setup"

/** The query parameter that opens the picture-and-name dialog of an agent's profile while it is `1`. */
export const IDENTITY_PARAM = "identity"

/** The query a menu link carries to open the picture-and-name dialog; closing the dialog drops it. */
export const IDENTITY_QUERY: string = `${IDENTITY_PARAM}=1`

/** The route of the "Chung" section of Setup (name, owner, pause, remove) of an instance: /agents/<type>/<id>/setup/general. */
export const setupGeneralHref = (module: ModuleKey, installationId: string): string =>
    `${agentHref(module, installationId, "setup")}/general`

/** The route of the workflows of an instance, or of one workflow by its key: /agents/<type>/<id>/workflows[/<workflowKey>]. */
export const workflowsHref = (module: ModuleKey, installationId: string, workflowKey?: string): string => {
    const base = agentHref(module, installationId, "workflows")
    return workflowKey === undefined ? base : `${base}/${encodeURIComponent(workflowKey)}`
}
