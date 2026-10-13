"use server"
import "server-only"

import { createHash } from "node:crypto"
import { headers } from "next/headers"
import type { PublicBookingAnswer, PublicBookingInput } from "@/modules/types"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"
import { toPublicAnswer, toPublicTimes } from "./public-booking.mapper"

const SLUG = /^[a-z0-9][a-z0-9-]{2,40}$/u
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu
const DATE = /^\d{4}-\d{2}-\d{2}$/u

/** The visitor's key for the rate limit: a hash of the address the proxy saw, never the address itself. */
const visitorKey = async (): Promise<string> => {
    const seen = await headers()
    const address =
        (seen.get("x-forwarded-for") ?? seen.get("x-real-ip") ?? "unknown").split(",")[0]?.trim() ?? "unknown"
    return createHash("sha256").update(`booking:${address}`).digest("hex").slice(0, 24)
}

const clip = (value: string, max: number): string => value.slice(0, max)

/** The free start times of one service on one local day of a public page (the page is read by anyone, so the database limits the rate). */
export const writePublicBookingTimes = async (
    slug: string,
    serviceId: string,
    date: string,
    party: number,
): Promise<DbOutcome<ReadonlyArray<string>>> => {
    if (!SLUG.test(slug) || !UUID.test(serviceId) || !DATE.test(date)) return dbFailure("invalid", "booking-times")
    const db = await createServerDbClient()
    const answer = toOutcome(
        await db.rpc("public_booking_times", {
            p_slug: slug,
            p_service: serviceId,
            p_date: date,
            p_party: Math.min(20, Math.max(1, Math.round(party) || 1)),
            p_visitor: await visitorKey(),
        }),
    )
    return answer.kind === "ok" ? dbOk(toPublicTimes(answer.value)) : answer
}

/** A visitor's booking request: the database validates, rate limits and places it; the answer carries a code the page turns into words. */
export const writePublicBookingRequest = async (input: PublicBookingInput): Promise<DbOutcome<PublicBookingAnswer>> => {
    if (!SLUG.test(input.slug) || !UUID.test(input.serviceId) || Number.isNaN(Date.parse(input.start))) {
        return dbFailure("invalid", "booking-request")
    }
    const db = await createServerDbClient()
    const answer = toOutcome(
        await db.rpc("public_booking_request", {
            p_slug: input.slug,
            p_service: input.serviceId,
            p_start: new Date(input.start).toISOString(),
            p_name: clip(input.name, 120),
            p_phone: clip(input.phone, 40),
            p_email: clip(input.email, 120),
            p_party: Math.min(20, Math.max(1, Math.round(input.party) || 1)),
            p_note: clip(input.note, 400),
            p_token: clip(input.token, 64),
            p_website: clip(input.website, 200),
            p_visitor: await visitorKey(),
        }),
    )
    return answer.kind === "ok" ? dbOk(toPublicAnswer(answer.value)) : answer
}
