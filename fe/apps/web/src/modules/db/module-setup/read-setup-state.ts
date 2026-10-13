import "server-only"

import type { SetupMessage, SetupRevision, SetupSession } from "@/modules/installations"
import { dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"
import { toMessage, toRevision, toSession } from "./module-setup.mapper"

const SESSIONS_LIMIT = 100
const MESSAGES_LIMIT = 2000

/** The setup chat of an installation: every revision, the open draft (the last revision when it is a draft) and the whole conversation. */
export type SetupChatState = {
    readonly revisions: Array<SetupRevision>
    readonly draft: SetupSession | null
    readonly messages: Array<SetupMessage>
}

/** Reads the revisions and the whole chat of an installation in one wave, oldest first. */
export const readSetupState = async (installationId: string): Promise<DbOutcome<SetupChatState>> => {
    const client = await createServerDbClient()
    const [sessions, messages] = await Promise.all([
        client
            .from("module_setup_sessions")
            .select("*")
            .eq("installation_id", installationId)
            .order("revision")
            .limit(SESSIONS_LIMIT),
        client
            .from("module_setup_messages")
            .select("*, session:module_setup_sessions!inner(installation_id)")
            .eq("session.installation_id", installationId)
            .order("created_at")
            .limit(MESSAGES_LIMIT),
    ])
    const sessionRows = toOutcome(sessions)
    if (sessionRows.kind !== "ok") return sessionRows
    const messageRows = toOutcome(messages)
    if (messageRows.kind !== "ok") return messageRows
    const latest = sessionRows.value.at(-1)
    const draft = latest !== undefined && latest.status === "draft" ? toSession(latest) : null
    return dbOk({
        revisions: sessionRows.value.map(toRevision),
        draft,
        messages: messageRows.value.map(toMessage),
    })
}
