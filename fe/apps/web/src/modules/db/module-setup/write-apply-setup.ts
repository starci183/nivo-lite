"use server"
import "server-only"

import { MODULE_REGISTRY, isModuleKey } from "@/modules/catalog"
import type { ModuleKey } from "@/modules/catalog"
import { allGatesConfirmed, gateEntry, gateLabel, gatesOf, snapshotOf } from "@/modules/installations"
import type { ContextSnapshot } from "@/modules/installations"
import { readMemberName } from "../modules/read-member-name"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { applySchema, toVersion } from "./module-setup.mapper"
import { writeDraftSession } from "./write-draft-session"

const BLOCK_END = "### end NIVO setup"
const BLOCK_PATTERN = /\n*### NIVO setup[\s\S]*?### end NIVO setup\s*/gu

const stripBlock = (value: string): string => value.replace(BLOCK_PATTERN, "").trimEnd()

/** The text written into the agent: behaviour rules into its instructions, business knowledge into its knowledge. */
const agentTexts = (moduleKey: ModuleKey, snapshot: ContextSnapshot, version: number, locale: "vi" | "en") => {
    const rules = gatesOf(moduleKey)
        .map((gate) => `- ${gateLabel(gate, locale)}: ${gateEntry(snapshot.gates, gate.key).evidence}`)
        .join("\n")
    const facts = snapshot.facts.map((fact) => `- ${fact.text}`).join("\n")
    const head = `### NIVO setup v${version}`
    return {
        instructions: `${head}\nConfirmed by the owner. Follow these rules exactly; when something is not covered, say a team member will confirm.\n${rules}\n${BLOCK_END}`,
        knowledge: `${head}\n${snapshot.summary}\n${facts}\n${rules}\n${BLOCK_END}`,
    }
}

/**
 * Applies the open draft: a new immutable context version becomes the one in use and the agent of the installation runs on it.
 * Answers the number of the version; the caller queues the sync of the agent copy.
 */
export const writeApplySetup = async (input: unknown): Promise<DbOutcome<{ version: number }>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = applySchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "apply-input")
    const installationId = parsed.data.id
    const locale = parsed.data.value
    const client = await createServerDbClient()
    const found = toOutcome(
        await client.from("module_installations").select("*").eq("id", installationId).maybeSingle(),
    )
    if (found.kind !== "ok") return found
    const installation = found.value
    if (!isModuleKey(installation.module_key)) return dbFailure("invalid", "module")
    const draft = await writeDraftSession({ installationId, locale })
    if (draft.kind !== "ok") return draft
    if (!allGatesConfirmed(installation.module_key, draft.value.gateEvidence))
        return dbFailure("invalid", "gates-unconfirmed")
    const snapshot = snapshotOf(draft.value.draft, draft.value.gateEvidence)
    const name = await readMemberName(installation.workspace_id, principal.value.id)
    if (name.kind !== "ok") return name

    const latest = await client
        .from("module_context_versions")
        .select("*")
        .eq("installation_id", installationId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle()
    if (latest.error !== null) return dbFailure("unavailable", latest.error.code)
    const last = latest.data === null ? null : toVersion(latest.data)
    if (
        last !== null &&
        installation.active_context_version_id === last.id &&
        JSON.stringify(last.snapshot) === JSON.stringify(snapshot)
    ) {
        return dbFailure("invalid", "unchanged")
    }
    const version = (last?.version ?? 0) + 1
    const created = toOutcome(
        await client
            .from("module_context_versions")
            .insert({
                workspace_id: installation.workspace_id,
                installation_id: installationId,
                version,
                snapshot,
                applied_by: name.value,
            })
            .select()
            .single(),
    )
    if (created.kind !== "ok") return created

    // Notes proposed from Office are part of this version now.
    const notes = await client
        .from("module_context_notes")
        .update({
            status: "applied",
            applied_version: version,
            decided_by: name.value,
            decided_at: new Date().toISOString(),
        })
        .eq("installation_id", installationId)
        .eq("status", "pending")
    if (notes.error !== null) return dbFailure("unavailable", notes.error.code)

    const keepsStatus = installation.status !== "installing" && installation.status !== "setup"
    const activated = await client
        .from("module_installations")
        .update({ active_context_version_id: created.value.id, status: keepsStatus ? installation.status : "ready" })
        .eq("id", installationId)
    if (activated.error !== null) return dbFailure("unavailable", activated.error.code)

    if (installation.agent_id !== null) {
        const agent = toOutcome(
            await client.from("agents").select("instructions, knowledge").eq("id", installation.agent_id).maybeSingle(),
        )
        if (agent.kind !== "ok") return agent
        const texts = agentTexts(installation.module_key, snapshot, version, locale)
        const written = await client
            .from("agents")
            .update({
                instructions: `${stripBlock(agent.value.instructions)}\n\n${texts.instructions}`.trim(),
                knowledge: `${stripBlock(agent.value.knowledge)}\n\n${texts.knowledge}`.trim(),
            })
            .eq("id", installation.agent_id)
        if (written.error !== null) return dbFailure("unavailable", written.error.code)
    }

    const closed = await client.from("module_setup_sessions").update({ status: "applied" }).eq("id", draft.value.id)
    if (closed.error !== null) return dbFailure("unavailable", closed.error.code)
    const next = await writeDraftSession({ installationId, locale })
    if (next.kind !== "ok") return next
    const event = await client.from("events").insert({
        workspace_id: installation.workspace_id,
        lead_id: null,
        kind: "module.context_applied",
        actor: name.value,
        summary: `${MODULE_REGISTRY[installation.module_key].name[locale]} v${version}`,
        evidence: null,
    })
    if (event.error !== null) return dbFailure("unavailable", event.error.code)
    return dbOk({ version })
}
