import "server-only"

import { dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"
import { toCardRow } from "./module-setup.mapper"
import type { SetupCardRow } from "./module-setup.mapper"

const CARDS_LIMIT = 500

/** Reads the confirm cards of the given setup sessions, oldest first; superseded cards are left out. */
export const readSetupCards = async (
    setupSessionIds: ReadonlyArray<string>,
): Promise<DbOutcome<Array<SetupCardRow>>> => {
    if (setupSessionIds.length === 0) return dbOk([])
    const client = await createServerDbClient()
    const result = toOutcome(
        await client
            .from("module_setup_writes")
            .select("*")
            .in("setup_session_id", [...setupSessionIds])
            .neq("status", "superseded")
            .order("created_at")
            .limit(CARDS_LIMIT),
    )
    return result.kind === "ok" ? dbOk(result.value.map(toCardRow)) : result
}

/** Reads one confirm card by id. */
export const readSetupCard = async (cardId: string): Promise<DbOutcome<SetupCardRow>> => {
    const client = await createServerDbClient()
    const result = toOutcome(await client.from("module_setup_writes").select("*").eq("id", cardId).maybeSingle())
    return result.kind === "ok" ? dbOk(toCardRow(result.value)) : result
}
