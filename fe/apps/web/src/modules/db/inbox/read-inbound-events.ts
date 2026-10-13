import "server-only"

import { cache } from "react"
import type { Database } from "../../../../../../../supabase/types/database.types"
import { createServerDbClient } from "../server"
import { toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"

/** One inbound event as the Inbox lists it. */
export type InboundEventRow = Pick<
    Database["public"]["Tables"]["inbound_events"]["Row"],
    | "id"
    | "channel"
    | "kind"
    | "origin"
    | "sender_name"
    | "sender_contact"
    | "body"
    | "amount_vnd"
    | "external_ref"
    | "event_id"
    | "duplicate_count"
    | "lead_id"
    | "status"
    | "created_at"
>

/** Reads the latest inbound events of the current RLS principal workspace, newest first. */
export const readInboundEvents = cache(async (limit: number): Promise<DbOutcome<ReadonlyArray<InboundEventRow>>> => {
    const client = await createServerDbClient()
    return toOutcome(
        await client
            .from("inbound_events")
            .select(
                "id, channel, kind, origin, sender_name, sender_contact, body, amount_vnd, external_ref, event_id, duplicate_count, lead_id, status, created_at",
            )
            .order("created_at", { ascending: false })
            .limit(limit),
    )
})
