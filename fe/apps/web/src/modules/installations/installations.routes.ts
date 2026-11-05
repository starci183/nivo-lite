import type { ModuleKey } from "@/modules/catalog"
import { AGENTS_ROUTE } from "@/modules/routes"

/** A tab of one agent instance; `performance` (the weekly report) belongs to the AI Marketing (content) agent only. */
export type AgentTab = "setup" | "workbench" | "inbox" | "work" | "performance" | "settings"

/**
 * The route of an agent instance: /agents/<type>/<installationId>[/workbench|/work|/performance|/settings][?query]. Without an installation id it is the
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
