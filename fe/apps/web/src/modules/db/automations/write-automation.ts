"use server"
import "server-only"

import { revalidatePath } from "next/cache"
import type { AutomationCardView } from "@/lib/automation-shared"
import { APP_ROUTES } from "@/modules/routes"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { AUTOMATIONS_LANGUAGES } from "./automations.texts"
import { parseAutomationInput } from "./automations.input"
import { planChange } from "./automations.plans"
import type { AuditKind, PipelineChange } from "./automations.plans"
import { readAutomations } from "./read-automations"

const AUDIT_KINDS: Readonly<Record<AuditKind, { readonly kind: string; readonly text: string }>> = {
    enabled: { kind: "automation.enabled", text: "auditEnabled" },
    disabled: { kind: "automation.disabled", text: "auditDisabled" },
    bodySaved: { kind: "automation.body_saved", text: "auditBodysaved" },
    autoSendGranted: { kind: "automation.auto_send_granted", text: "auditAutosendgranted" },
    autoSendDeclined: { kind: "automation.auto_send_declined", text: "auditAutosenddeclined" },
}

type Db = Awaited<ReturnType<typeof createServerDbClient>>

const evidenceOf = (audit: AuditKind, card: AutomationCardView, change: PipelineChange): string | null => {
    if (audit === "bodySaved") return (change.body ?? "").slice(0, 600)
    if (audit === "autoSendGranted" || audit === "autoSendDeclined") {
        return AUTOMATIONS_LANGUAGES.vi("auditStreak", { count: String(card.trust.streak) })
    }
    return null
}

const googleIdsOf = async (db: Db, workspaceId: string): Promise<ReadonlyArray<string>> => {
    const { data } = await db
        .from("connections")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("provider", "google")
        .neq("status", "disconnected")
        .limit(20)
    return (data ?? []).map((row) => row.id)
}

/**
 * Changes one pipeline of a workspace the principal manages: hide it, move its Google account, save its settings and wording, answer
 * "send by itself", switch it on or off. The row is written under RLS (only an owner or manager may), the lines of evidence follow, and
 * the answer is the card as it stands afterwards.
 */
export const writeAutomation = async (input: unknown): Promise<DbOutcome<AutomationCardView>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = parseAutomationInput(input)
    if (!parsed.success) return dbFailure("invalid", "automation-input")
    const { workspaceId, templateKey, patch } = parsed.data
    const before = await readAutomations(workspaceId)
    if (before.kind !== "ok") return before
    const card = before.value.cards.find((candidate) => candidate.key === templateKey)
    if (card === undefined) return dbFailure("not-found", "automation-template")
    const db = await createServerDbClient()
    const planned = planChange(card, patch, {
        contextVersion: card.currentContext,
        googleIds: await googleIdsOf(db, workspaceId),
    })
    if (planned.kind !== "ok") return planned
    const { change, audits } = planned.value
    const saved = await savePipeline(db, { workspaceId, card, userId: principal.value.id, change })
    if (saved.kind !== "ok") return saved
    const actor = principal.value.metadata.full_name ?? principal.value.metadata.name ?? principal.value.email ?? ""
    await db.from("events").insert(
        audits.map((audit) => ({
            workspace_id: workspaceId,
            kind: AUDIT_KINDS[audit].kind,
            actor,
            summary: AUTOMATIONS_LANGUAGES.vi(AUDIT_KINDS[audit].text, { name: card.def.name.vi }),
            evidence: evidenceOf(audit, card, change),
        })),
    )
    revalidatePath(APP_ROUTES.automations)
    const after = await readAutomations(workspaceId)
    if (after.kind !== "ok") return after
    const next = after.value.cards.find((candidate) => candidate.key === templateKey)
    return next === undefined ? dbFailure("not-found", "automation-template") : dbOk(next)
}

type SaveInput = {
    readonly workspaceId: string
    readonly card: AutomationCardView
    readonly userId: string
    readonly change: PipelineChange
}

const savePipeline = async (db: Db, input: SaveInput): Promise<DbOutcome<null>> => {
    const { workspaceId, card, userId, change } = input
    const stamp = new Date().toISOString()
    if (card.pipelineId !== null) {
        const result = await db
            .from("automation_pipelines")
            .update({ ...change, updated_at: stamp })
            .eq("id", card.pipelineId)
            .eq("workspace_id", workspaceId)
            .select("id")
            .single()
        const written = toOutcome(result)
        return written.kind === "ok" ? dbOk(null) : written
    }
    const result = await db
        .from("automation_pipelines")
        .insert({
            workspace_id: workspaceId,
            template_key: card.key,
            name: card.def.name.vi,
            module_key: card.def.moduleKey,
            template_version: card.def.version,
            created_by: userId,
            config: card.config,
            ...change,
        })
        .select("id")
        .single()
    const written = toOutcome(result)
    return written.kind === "ok" ? dbOk(null) : written
}
