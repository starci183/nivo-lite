import "server-only"
import { cache } from "react"
import { readOfficePayload } from "@/modules/db"
import type { OfficePayload } from "@/modules/db"
import { getSession } from "./session"

/**
 * Legacy shim of the page payloads. One request per heavy page: the SQL function `office_data` returns the rows the
 * page used to read with several requests, under the caller RLS. The readers live in `modules/db/pagedata`. A failed call returns
 * null and the page falls back to its separate reads (for example before a migration is applied).
 */
const DAY = 86_400_000

/** The Office payload with the start of the 7-day window it was read with. */
export type OfficeData = OfficePayload & { since7: string }

/** The Office payload, or null when the single request is unavailable. */
export const getOfficeData = cache(async (): Promise<OfficeData | null> => {
    const session = await getSession()
    const since7 = new Date(Date.now() - 7 * DAY).toISOString()
    const outcome = await readOfficePayload({ workspaceId: session.workspace.id, since7 })
    if (outcome.kind !== "ok") return null
    return { ...outcome.value, since7 }
})
