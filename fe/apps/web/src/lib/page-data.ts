import "server-only"
import { cache } from "react"
import { readDashboardPayload, readOfficePayload } from "@/modules/db"
import type { DashboardPayload, OfficePayload } from "@/modules/db"
import { FOUNDING_OFFER } from "./promo"
import { getSession } from "./session"

/**
 * Legacy shim of the page payloads. One request per heavy page: the SQL functions `dashboard_data` and `office_data` return the rows the
 * page used to read with 7-12 separate requests, under the caller RLS. The readers live in `modules/db/pagedata`. A failed call returns
 * null and the page falls back to its separate reads (for example before a migration is applied).
 */
const DAY = 86_400_000

/** The dashboard payload with the start of the 7-day window it was read with. */
export type DashboardData = DashboardPayload & { since7: string }

/** The dashboard payload, or null when the single request is unavailable. */
export const getDashboardData = cache(async (): Promise<DashboardData | null> => {
    const session = await getSession()
    const since7 = new Date(Date.now() - 7 * DAY).toISOString()
    const outcome = await readDashboardPayload({
        workspaceId: session.workspace.id,
        since7,
        foundingFrom: FOUNDING_OFFER.startsAt,
        foundingTo: FOUNDING_OFFER.endsAt,
    })
    if (outcome.kind !== "ok") return null
    return { ...outcome.value, since7 }
})

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
