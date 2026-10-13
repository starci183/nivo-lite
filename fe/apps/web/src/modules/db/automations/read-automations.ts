import "server-only"

import type { TemplateDef } from "@/lib/automation-shared"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { isOverviewRows, isTemplateDef } from "./automations.guards"
import { AUTOMATIONS_LANGUAGES } from "./automations.texts"
import { assembleAutomations } from "./automations.view"
import type { AutomationsView } from "./automations.view"

const TEMPLATES_MAX = 200
const ACCOUNTS_MAX = 20

/**
 * Everything the automations screen shows for a workspace the current RLS principal manages: the pipelines, the latest runs and the
 * shop come from one database function, the templates from the catalogue; the cards are assembled here.
 */
export const readAutomations = async (workspaceId: string): Promise<DbOutcome<AutomationsView>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const db = await createServerDbClient()
    const [data, catalogue, accounts] = await Promise.all([
        db.rpc("automations_data", { ws: workspaceId }),
        db
            .from("automation_templates")
            .select("definition")
            .order("position", { ascending: true })
            .order("key", { ascending: true })
            .limit(TEMPLATES_MAX),
        db
            .from("connections")
            .select("id, name, status")
            .eq("workspace_id", workspaceId)
            .eq("provider", "google")
            .neq("status", "disconnected")
            .limit(ACCOUNTS_MAX),
    ])
    const rows = toOutcome(data)
    const templates = toOutcome(catalogue)
    if (rows.kind !== "ok") return rows
    if (templates.kind !== "ok") return templates
    const connected = toOutcome(accounts)
    if (connected.kind !== "ok") return connected
    if (!isOverviewRows(rows.value)) return dbFailure("unavailable", "automations-shape")
    const defs: Array<TemplateDef> = []
    for (const template of templates.value) {
        if (isTemplateDef(template.definition)) defs.push(template.definition)
    }
    const view = assembleAutomations(rows.value, defs, AUTOMATIONS_LANGUAGES)
    return dbOk({
        ...view,
        accounts: connected.value.map((row) => ({
            id: row.id,
            name: row.name,
            status: row.status === "error" ? "error" : "connected",
        })),
    })
}
