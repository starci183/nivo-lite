import "server-only"

import { createServerDbClient } from "../server"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { inviteTokenSchema, previewFromRows } from "./invite.mapper"
import type { InvitePreview } from "./invite.mapper"

/**
 * What the holder of an invitation link may see before signing in: workspace, role, linked staff member and whether the link
 * still works. The `invite_preview` function is callable without a session and reveals nothing else; an unknown token is not-found.
 */
export const readInvitePreview = async (token: string): Promise<DbOutcome<InvitePreview>> => {
    const parsed = inviteTokenSchema.safeParse(token)
    if (!parsed.success) return dbFailure("invalid", "invite-token")
    const client = await createServerDbClient()
    const rows = toOutcome(await client.rpc("invite_preview", { token: parsed.data }))
    if (rows.kind !== "ok") return rows
    const preview = previewFromRows(rows.value)
    return preview === null ? dbFailure("not-found", "invite") : dbOk(preview)
}
