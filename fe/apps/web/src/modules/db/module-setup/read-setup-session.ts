import "server-only"

import type { SetupSession } from "@/modules/installations"
import { dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"
import { toSession } from "./module-setup.mapper"

/** Reads one setup session by id, whatever its status. */
export const readSetupSession = async (setupSessionId: string): Promise<DbOutcome<SetupSession>> => {
    const client = await createServerDbClient()
    const result = toOutcome(
        await client.from("module_setup_sessions").select("*").eq("id", setupSessionId).maybeSingle(),
    )
    return result.kind === "ok" ? dbOk(toSession(result.value)) : result
}
