"use server"
import "server-only"

import { dbFailure, dbOk } from "../outcome"
import type { DbOutcome } from "../outcome"
import { getPrincipal } from "../principal"
import { createServerDbClient } from "../server"
import { cardsSchema } from "./module-setup.mapper"
import { readSetupSession } from "./read-setup-session"

/**
 * Stores the cards a turn proposed for the owner to confirm. A card replaces the waiting card of the same target (the old one is
 * marked superseded); nothing is written to the Second Brain or the authority rules until the owner confirms a card.
 */
export const writeSetupCards = async (input: unknown): Promise<DbOutcome<number>> => {
    const principal = await getPrincipal()
    if (principal.kind !== "ok") return dbFailure("refused", "principal")
    const parsed = cardsSchema.safeParse(input)
    if (!parsed.success) return dbFailure("invalid", "cards-input")
    const { sourceMessageId, cards } = parsed.data.value
    const session = await readSetupSession(parsed.data.id)
    if (session.kind !== "ok") return session
    const client = await createServerDbClient()
    const superseded = await Promise.all(
        cards.map((card) =>
            client
                .from("module_setup_writes")
                .update({ status: "superseded" })
                .eq("setup_session_id", session.value.id)
                .eq("target_key", card.targetKey)
                .eq("status", "proposed"),
        ),
    )
    const failed = superseded.find((result) => result.error !== null)
    if (failed?.error) return dbFailure("unavailable", failed.error.code)
    const inserted = await client.from("module_setup_writes").insert(
        cards.map((card) => ({
            workspace_id: session.value.workspaceId,
            setup_session_id: session.value.id,
            source_message_id: sourceMessageId,
            gate_key: card.gateKey,
            kind: card.kind,
            target_key: card.targetKey,
            payload: card.payload,
        })),
    )
    return inserted.error === null ? dbOk(cards.length) : dbFailure("unavailable", inserted.error.code)
}
