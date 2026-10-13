import "server-only"
import { listInstances } from "./modules-core"
import { agentHref, agentListHref, type ModuleKey } from "./modules-shared"
import { supabaseServer } from "./supabase/server"

/**
 * Old type-level agent URLs (/agents/<type>, /agents/<type>/workbench?focus=..., /agents/<type>/settings) keep working after agents became
 * instances (/agents/<type>/<installationId>/...). One instance: straight to it. Several: to the instance that owns the `?focus=` record
 * (a work item, conversation, booking, lead flow or lead), else to the list of instances.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** The instance that handles a record, among the given ones (installation_id on the row, set by the database). Null when none says. */
export const installationOfRecord = async (recordId: string, among: ReadonlyArray<string>): Promise<string | null> => {
    if (!UUID.test(recordId) || among.length === 0) return null
    const db = await supabaseServer()
    const tables = ["work_items", "agent_conversations", "bookings", "lead_flows", "leads"] as const
    const found = await Promise.all(
        tables.map(async (table) => {
            const { data } = await db.from(table).select("installation_id").eq("id", recordId).maybeSingle()
            return (data as { installation_id: string | null } | null)?.installation_id ?? null
        }),
    )
    return found.find((id): id is string => id !== null && among.includes(id)) ?? null
}

const queryOf = (search: Readonly<Record<string, string | string[] | undefined>>): string => {
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries(search)) {
        if (k === "list") continue
        for (const one of Array.isArray(v) ? v : v === undefined ? [] : [v]) q.append(k, one)
    }
    return q.toString()
}

/** Where a type-level URL goes now; null = show the list of instances here. "/agents" when the type is not installed. */
export const resolveTypeRoute = async (
    module: ModuleKey,
    tab: "setup" | "workbench" | "settings",
    search: Readonly<Record<string, string | string[] | undefined>>,
): Promise<string | null> => {
    const instances = await listInstances(module)
    if (instances.length === 0) return "/agents"
    const query = queryOf(search)
    if (instances.length === 1) return agentHref(module, instances[0].id, tab, query)
    const focus = Array.isArray(search.focus) ? search.focus[0] : search.focus
    const owner = focus
        ? await installationOfRecord(
              focus,
              instances.map((i) => i.id),
          )
        : null
    if (owner) return agentHref(module, owner, tab, query)
    return tab === "setup" ? null : agentListHref(module)
}
