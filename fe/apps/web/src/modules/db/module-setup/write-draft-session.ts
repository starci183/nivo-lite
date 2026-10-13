"use server"
import "server-only"

import { getTranslations } from "next-intl/server"
import { MODULE_REGISTRY } from "@/modules/catalog"
import type { SetupSession } from "@/modules/installations"
import { readInstallation } from "../modules/read-installation"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { applySchema, toSession } from "./module-setup.mapper"

/** Opens the setup chat of an installation: answers its open draft, or starts the next revision (the first one with the welcome of NIVO). */
export const writeDraftSession = async (input: unknown): Promise<DbOutcome<SetupSession>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = applySchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "draft-session-input")
    const installation = await readInstallation(parsed.data.id)
    if (installation.kind !== "ok") return installation
    const client = await createServerDbClient()
    const latest = await client
        .from("module_setup_sessions")
        .select("*")
        .eq("installation_id", installation.value.id)
        .order("revision", { ascending: false })
        .limit(1)
        .maybeSingle()
    if (latest.error !== null) return dbFailure("unavailable", latest.error.code)
    if (latest.data !== null && latest.data.status === "draft") return dbOk(toSession(latest.data))
    const previous = latest.data === null ? null : toSession(latest.data)
    const created = await client
        .from("module_setup_sessions")
        .insert({
            workspace_id: installation.value.workspaceId,
            installation_id: installation.value.id,
            revision: (previous?.revision ?? 0) + 1,
            draft_snapshot: previous?.draft ?? { summary: "", facts: [] },
            gate_evidence: previous?.gateEvidence ?? {},
        })
        .select()
        .single()
    if (created.error !== null) {
        // Another tab won the race: use the session it created.
        const again = toOutcome(
            await client
                .from("module_setup_sessions")
                .select("*")
                .eq("installation_id", installation.value.id)
                .order("revision", { ascending: false })
                .limit(1)
                .maybeSingle(),
        )
        return again.kind === "ok" ? dbOk(toSession(again.value)) : again
    }
    if (previous === null) {
        const t = await getTranslations({ locale: parsed.data.value, namespace: "moduleSetup" })
        const typeName = MODULE_REGISTRY[installation.value.moduleKey].name[parsed.data.value]
        const welcome = await client.from("module_setup_messages").insert({
            workspace_id: installation.value.workspaceId,
            setup_session_id: created.data.id,
            role: "assistant",
            author: "NIVO",
            body: t("welcome", {
                module: installation.value.isMulti ? `${typeName} – ${installation.value.name}` : typeName,
            }),
        })
        if (welcome.error !== null) return dbFailure("unavailable", welcome.error.code)
    }
    return dbOk(toSession(created.data))
}
