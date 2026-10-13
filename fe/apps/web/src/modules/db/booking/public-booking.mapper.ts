import type { Json } from "../../../../../../../supabase/types/database.types"
import type { BookingPlacement, PublicBookingAnswer, PublicBookingPage, PublicBookingService } from "@/modules/types"

/** A JSON object as a record, or null for anything else. */
const recordOf = (value: Json | undefined): { readonly [key: string]: Json | undefined } | null =>
    typeof value === "object" && value !== null && !Array.isArray(value) ? value : null

const textOf = (value: Json | undefined): string => (typeof value === "string" ? value : "")

const numberOf = (value: Json | undefined): number | null => (typeof value === "number" ? value : null)

const textsOf = (value: Json | undefined): ReadonlyArray<string> =>
    Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []

const serviceOf = (value: Json | undefined): PublicBookingService | null => {
    const row = recordOf(value)
    if (row === null || typeof row["id"] !== "string") return null
    return {
        id: row["id"],
        name: textOf(row["name"]),
        description: textOf(row["description"]),
        durationMin: numberOf(row["durationMin"]) ?? 0,
        priceVnd: numberOf(row["priceVnd"]),
    }
}

/** The public page as the database answers it; null when the slug has no page. */
export const toPublicPage = (json: Json): PublicBookingPage | null => {
    const row = recordOf(json)
    if (row === null || typeof row["slug"] !== "string") return null
    const services = Array.isArray(row["services"]) ? row["services"] : []
    return {
        shop: textOf(row["shop"]),
        slug: row["slug"],
        note: textOf(row["note"]),
        address: textOf(row["address"]),
        timezone: textOf(row["timezone"]),
        services: services.map(serviceOf).filter((service): service is PublicBookingService => service !== null),
    }
}

/** The free start times of one day. */
export const toPublicTimes = (json: Json): ReadonlyArray<string> => textsOf(recordOf(json)?.["times"])

const STATES: ReadonlyArray<PublicBookingAnswer["state"]> = ["confirmed", "waiting", "invalid", "failed"]

/** The answer to a visitor's request. */
export const toPublicAnswer = (json: Json): PublicBookingAnswer => {
    const row = recordOf(json)
    const state = STATES.find((candidate) => candidate === row?.["state"]) ?? "failed"
    return {
        ok: row?.["ok"] === true,
        state,
        code: textOf(row?.["code"]),
        service: textOf(row?.["service"]),
        start: textOf(row?.["start"]),
        alternatives: textsOf(row?.["alternatives"]),
        bookingId: typeof row?.["bookingId"] === "string" ? row["bookingId"] : null,
    }
}

/** The answer to an add or a move by the owner. */
export const toPlacement = (json: Json): BookingPlacement => {
    const row = recordOf(json)
    return {
        ok: row?.["ok"] === true,
        reason: typeof row?.["reason"] === "string" ? row["reason"] : null,
        id: typeof row?.["id"] === "string" ? row["id"] : null,
    }
}
