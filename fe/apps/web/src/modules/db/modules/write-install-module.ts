"use server"
import "server-only"

import { MODULE_REGISTRY } from "@/modules/catalog"
import { cleanInstanceName, instanceNameKey, nextInstanceName } from "@/modules/installations"
import { writeDraftSession } from "../module-setup/write-draft-session"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { defaultRuleRows, installSchema } from "./modules.mapper"
import { readMemberName } from "./read-member-name"

const HANDLE_LIMIT = 1000
const HANDLES_READ_LIMIT = 200

/** What installing an agent answers: the installation, its agent and whether the call created it. */
export type InstallResult = {
    readonly installationId: string
    readonly agentId: string | null
    readonly created: boolean
}

/**
 * Installs a module in a workspace: its agent (reused when the workspace already has one, except for an added instance), the
 * installation, its default authority rules (never overwriting what the owner already set) and the first setup session. Without
 * `newInstance` the call is idempotent and answers the first installation of the type.
 */
export const writeInstallModule = async (input: unknown): Promise<DbOutcome<InstallResult>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = installSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "install-input")
    const { workspaceId, moduleKey, locale, newInstance } = parsed.data
    const def = MODULE_REGISTRY[moduleKey]
    const wanted = parsed.data.name === null ? null : cleanInstanceName(parsed.data.name)
    if (parsed.data.name !== null && wanted === null) return dbFailure("invalid", "instance-name")
    if (newInstance && !def.multiInstance) return dbFailure("invalid", "single-instance-only")

    const client = await createServerDbClient()
    const existing = await client
        .from("module_installations")
        .select("id, agent_id")
        .eq("workspace_id", workspaceId)
        .eq("module_key", moduleKey)
        .order("created_at")
        .limit(1)
        .maybeSingle()
    if (existing.error !== null) return dbFailure("unavailable", existing.error.code)
    let installationId = newInstance ? undefined : existing.data?.id
    let agentId = newInstance ? null : (existing.data?.agent_id ?? null)
    let created = false

    if (installationId === undefined) {
        const siblings = toOutcome(
            await client
                .from("module_installations")
                .select("name")
                .eq("workspace_id", workspaceId)
                .eq("module_key", moduleKey)
                .limit(HANDLES_READ_LIMIT),
        )
        const taken = siblings.kind === "ok" ? siblings.value.map((row) => row.name) : []
        const name = wanted ?? nextInstanceName(def.name[locale], taken)
        if (taken.some((other) => instanceNameKey(other) === instanceNameKey(name))) {
            return dbFailure("invalid", "instance-name-taken")
        }

        // The first instance may take over a legacy agent of the module; an added instance always gets its own agent.
        if (!newInstance) {
            const legacy = await client
                .from("agents")
                .select("id")
                .eq("workspace_id", workspaceId)
                .eq("module", moduleKey)
                .order("created_at")
                .limit(1)
                .maybeSingle()
            if (legacy.error !== null) return dbFailure("unavailable", legacy.error.code)
            agentId = legacy.data?.id ?? null
            if (agentId !== null) {
                const bound = await client
                    .from("module_installations")
                    .select("id")
                    .eq("agent_id", agentId)
                    .maybeSingle()
                if (bound.error !== null) return dbFailure("unavailable", bound.error.code)
                if (bound.data !== null) agentId = null
            }
        }
        if (agentId === null) {
            const handles = toOutcome(
                await client
                    .from("agents")
                    .select("handle")
                    .eq("workspace_id", workspaceId)
                    .like("handle", `${def.agent.handle}%`)
                    .limit(HANDLES_READ_LIMIT),
            )
            const used = new Set(handles.kind === "ok" ? handles.value.map((row) => row.handle) : [])
            const handle =
                [
                    def.agent.handle,
                    ...Array.from({ length: HANDLE_LIMIT }, (_, n) => `${def.agent.handle}-${n + 2}`),
                ].find((candidate) => !used.has(candidate)) ?? `${def.agent.handle}-${used.size + HANDLE_LIMIT}`
            const made = toOutcome(
                await client
                    .from("agents")
                    .insert({
                        workspace_id: workspaceId,
                        module: moduleKey,
                        name: newInstance ? name.slice(0, 40) : def.agent.name,
                        handle,
                        role: def.agent.role[locale],
                        instructions: def.agent.instructions[locale],
                    })
                    .select("id")
                    .single(),
            )
            if (made.kind !== "ok") return made
            agentId = made.value.id
        }
        const inserted = await client
            .from("module_installations")
            .insert({
                workspace_id: workspaceId,
                module_key: moduleKey,
                name,
                agent_id: agentId,
                status: "setup",
                operating_mode: def.defaultOperatingMode,
            })
            .select("id")
            .single()
        if (inserted.error === null) {
            installationId = inserted.data.id
            created = true
            const member = await readMemberName(workspaceId, principal.value.id)
            const actor = member.kind === "ok" ? member.value : ""
            const event = await client.from("events").insert({
                workspace_id: workspaceId,
                lead_id: null,
                kind: "module.installed",
                actor,
                summary: `${actor}: ${def.name[locale]}${name === def.name[locale] ? "" : ` – ${name}`}`,
                evidence: null,
            })
            if (event.error !== null) return dbFailure("unavailable", event.error.code)
        } else if (newInstance) {
            return dbFailure("invalid", inserted.error.code)
        } else {
            // Lost a race with another tab: the installation it created is the one.
            const again = toOutcome(
                await client
                    .from("module_installations")
                    .select("id")
                    .eq("workspace_id", workspaceId)
                    .eq("module_key", moduleKey)
                    .order("created_at")
                    .limit(1)
                    .single(),
            )
            if (again.kind !== "ok") return again
            installationId = again.value.id
        }
    }

    // The default authority rules of the module: only the missing ones are added, so a choice of the owner is never reset.
    const rules = await client.from("authority_rules").upsert(defaultRuleRows(workspaceId, moduleKey), {
        onConflict: "workspace_id,department,action",
        ignoreDuplicates: true,
    })
    if (rules.error !== null) return dbFailure("unavailable", rules.error.code)
    const session = await writeDraftSession({ installationId, locale })
    if (session.kind !== "ok") return session
    return dbOk({ installationId, agentId, created })
}
