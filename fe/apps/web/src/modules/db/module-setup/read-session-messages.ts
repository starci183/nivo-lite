import "server-only"

import type { SetupMessage } from "@/modules/installations"
import { dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"
import { toMessage } from "./module-setup.mapper"

const MESSAGES_LIMIT = 2000

/** Reads the chat messages of one setup session, oldest first. */
export const readSessionMessages = async (setupSessionId: string): Promise<DbOutcome<Array<SetupMessage>>> => {
    const client = await createServerDbClient()
    const result = toOutcome(
        await client
            .from("module_setup_messages")
            .select("*")
            .eq("setup_session_id", setupSessionId)
            .order("created_at")
            .limit(MESSAGES_LIMIT),
    )
    return result.kind === "ok" ? dbOk(result.value.map(toMessage)) : result
}
