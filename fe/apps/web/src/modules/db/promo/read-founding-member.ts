import "server-only"

import { FOUNDING_OFFER, isOfferLive } from "@/modules/promo"
import { dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"
import { readActiveWorkspace } from "../workspace/read-active-workspace"

/** True when a `module.purchased` event exists inside the Founding 50 window and the offer is live now. */
export const readFoundingMember = async (): Promise<DbOutcome<boolean>> => {
    const workspace = await readActiveWorkspace()
    if (workspace.kind !== "ok") return workspace
    const client = await createServerDbClient()
    const rows = toOutcome(
        await client
            .from("events")
            .select("id")
            .eq("workspace_id", workspace.value.id)
            .eq("kind", "module.purchased")
            .gte("created_at", new Date(FOUNDING_OFFER.startsAt).toISOString())
            .lte("created_at", new Date(FOUNDING_OFFER.endsAt).toISOString())
            .limit(1),
    )
    return rows.kind === "ok" ? dbOk(isOfferLive(Date.now()) && rows.value.length > 0) : rows
}
