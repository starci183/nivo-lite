"use server"
import "server-only"

import type { SetupMessage } from "@/modules/installations"
import { readMemberName } from "../modules/read-member-name"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { messageSchema, toMessage } from "./module-setup.mapper"
import { readSetupSession } from "./read-setup-session"

/** Stores one message of the owner in the open draft of the setup chat under the name the member goes by. */
export const writeSetupMessage = async (input: unknown): Promise<DbOutcome<SetupMessage>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = messageSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "message-input")
    const session = await readSetupSession(parsed.data.id)
    if (session.kind !== "ok") return session
    if (session.value.status !== "draft") return dbFailure("not-found", "session-closed")
    const name = await readMemberName(session.value.workspaceId, principal.value.id)
    if (name.kind !== "ok") return name
    const client = await createServerDbClient()
    const inserted = toOutcome(
        await client
            .from("module_setup_messages")
            .insert({
                workspace_id: session.value.workspaceId,
                setup_session_id: session.value.id,
                role: "user",
                author: name.value,
                body: parsed.data.value,
            })
            .select()
            .single(),
    )
    return inserted.kind === "ok" ? dbOk(toMessage(inserted.value)) : inserted
}
