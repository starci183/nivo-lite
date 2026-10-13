"use server"
import "server-only"

import { readMemberName } from "../modules/read-member-name"
import { dbFailure, dbOk } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { closeCardSchema, toCardRow } from "./module-setup.mapper"
import type { SetupCardRow } from "./module-setup.mapper"
import { readSetupCard } from "./read-setup-cards"

/** Closes a waiting confirm card as applied or rejected, recording who decided and what was written; a card decided twice is refused. */
export const writeCloseCard = async (input: unknown): Promise<DbOutcome<SetupCardRow>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = closeCardSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "card-input")
    const { status, payload, result } = parsed.data.value
    const card = await readSetupCard(parsed.data.id)
    if (card.kind !== "ok") return card
    const name = await readMemberName(card.value.workspaceId, principal.value.id)
    if (name.kind !== "ok") return name
    const client = await createServerDbClient()
    const closed = await client
        .from("module_setup_writes")
        .update({ status, payload, result, decided_by: name.value, decided_at: new Date().toISOString() })
        .eq("id", card.value.id)
        .eq("status", "proposed")
        .select("*")
        .maybeSingle()
    if (closed.error !== null) return dbFailure("unavailable", closed.error.code)
    return closed.data === null ? dbFailure("invalid", "already-decided") : dbOk(toCardRow(closed.data))
}
