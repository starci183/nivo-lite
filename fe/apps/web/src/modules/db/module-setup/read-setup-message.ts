import "server-only"

import type { SetupMessage } from "@/modules/installations"
import { dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"
import { toMessage } from "./module-setup.mapper"

/** Reads one setup chat message by id. */
export const readSetupMessage = async (messageId: string): Promise<DbOutcome<SetupMessage>> => {
    const client = await createServerDbClient()
    const result = toOutcome(await client.from("module_setup_messages").select("*").eq("id", messageId).maybeSingle())
    return result.kind === "ok" ? dbOk(toMessage(result.value)) : result
}
