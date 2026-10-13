"use server"
import "server-only"

import { isModuleKey } from "@/modules/catalog"
import { gateEntry, gatesOf } from "@/modules/installations"
import type { GateEvidence, SetupSession } from "@/modules/installations"
import { readInstallation } from "../modules/read-installation"
import { readMemberName } from "../modules/read-member-name"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { gateSchema, toSession } from "./module-setup.mapper"
import { readSetupSession } from "./read-setup-session"

/** Confirms, reopens or edits one gate of the open draft; editing sets the own wording of the owner and confirms it. */
export const writeGate = async (input: unknown): Promise<DbOutcome<SetupSession>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = gateSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "gate-input")
    const { gateKey, action } = parsed.data.value
    const session = await readSetupSession(parsed.data.id)
    if (session.kind !== "ok") return session
    if (session.value.status !== "draft") return dbFailure("not-found", "session-closed")
    const installation = await readInstallation(session.value.installationId)
    if (installation.kind !== "ok") return installation
    if (!isModuleKey(installation.value.moduleKey)) return dbFailure("invalid", "module")
    if (!gatesOf(installation.value.moduleKey).some((gate) => gate.key === gateKey)) return dbFailure("invalid", "gate")
    const evidence =
        action === "edit" ? parsed.data.value.evidence : gateEntry(session.value.gateEvidence, gateKey).evidence
    if (action !== "reopen" && evidence === "") return dbFailure("invalid", "gate-empty")
    const name = await readMemberName(session.value.workspaceId, principal.value.id)
    if (name.kind !== "ok") return name
    const gates: GateEvidence = {
        ...session.value.gateEvidence,
        [gateKey]:
            action === "reopen"
                ? { status: "proposed", evidence }
                : { status: "confirmed", evidence, confirmed_by: name.value, confirmed_at: new Date().toISOString() },
    }
    const client = await createServerDbClient()
    const updated = toOutcome(
        await client
            .from("module_setup_sessions")
            .update({ gate_evidence: gates })
            .eq("id", session.value.id)
            .select()
            .single(),
    )
    return updated.kind === "ok" ? dbOk(toSession(updated.value)) : updated
}
