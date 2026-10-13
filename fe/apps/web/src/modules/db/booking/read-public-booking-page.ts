import "server-only"

import type { PublicBookingPage } from "@/modules/types"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"
import { toPublicPage } from "./public-booking.mapper"

const SLUG = /^[a-z0-9][a-z0-9-]{2,40}$/u

/** The public booking page of a slug, for a visitor without an account; not-found when the slug has no page or the owner switched it off. */
export const readPublicBookingPage = async (slug: string): Promise<DbOutcome<PublicBookingPage>> => {
    if (!SLUG.test(slug)) return dbFailure("not-found", "booking-slug")
    const db = await createServerDbClient()
    const answer = toOutcome(await db.rpc("public_booking_page", { p_slug: slug }))
    if (answer.kind !== "ok") return answer
    const page = toPublicPage(answer.value)
    return page === null ? dbFailure("not-found", "booking-page") : dbOk(page)
}
