"use server"
import "server-only"

import type { SetupSession } from "@/modules/installations"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { toSession, turnSchema } from "./module-setup.mapper"

/** Stores what one setup turn produced: the draft and the gate evidence on the session, and the reply of NIVO as the next message. */
export const writeSetupTurn = async (input: unknown): Promise<DbOutcome<SetupSession>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = turnSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "turn-input")
    const { reply, draft, gates } = parsed.data.value
    const client = await createServerDbClient()
    const updated = toOutcome(
        await client
            .from("module_setup_sessions")
            .update({ draft_snapshot: draft, gate_evidence: gates })
            .eq("id", parsed.data.id)
            .eq("status", "draft")
            .select()
            .single(),
    )
    if (updated.kind !== "ok") return updated
    const stored = await client.from("module_setup_messages").insert({
        workspace_id: updated.value.workspace_id,
        setup_session_id: parsed.data.id,
        role: "assistant",
        author: "NIVO",
        body: reply,
    })
    return stored.error === null ? dbOk(toSession(updated.value)) : dbFailure("unavailable", stored.error.code)
}
