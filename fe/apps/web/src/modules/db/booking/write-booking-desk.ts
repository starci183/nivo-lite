"use server"
import "server-only"

import { revalidatePath } from "next/cache"
import type { BookingAddInput, BookingMoveInput, BookingPlacement } from "@/modules/types"
import { getPrincipal } from "../principal"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"
import { toPlacement } from "./public-booking.mapper"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu
const DATE = /^\d{4}-\d{2}-\d{2}$/u
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/u

/** Adds a booking by hand. The database proves the caller manages the workspace and places it under the lock of the resource; a refusal comes back as a reason, not an error. */
export const writeBookingAdd = async (input: BookingAddInput): Promise<DbOutcome<BookingPlacement>> => {
    if ((await getPrincipal()).kind !== "ok") return dbFailure("refused", "principal")
    if (!UUID.test(input.workspaceId) || !DATE.test(input.date) || !CLOCK.test(input.time)) {
        return dbFailure("invalid", "booking-add")
    }
    if (input.serviceId === "") return dbOk({ ok: false, reason: "service_required", id: null })
    if (!UUID.test(input.serviceId)) return dbFailure("invalid", "booking-add")
    if (input.resourceId !== "" && !UUID.test(input.resourceId)) return dbFailure("invalid", "booking-add")
    const db = await createServerDbClient()
    const answer = toOutcome(
        await db.rpc("desk_booking_add", {
            p_workspace: input.workspaceId,
            p_service: input.serviceId,
            p_date: input.date,
            p_time: input.time,
            p_name: input.name.slice(0, 120),
            p_phone: input.phone.slice(0, 40),
            p_party: Math.min(20, Math.max(1, Math.round(input.party) || 1)),
            p_note: input.note.slice(0, 400),
            p_force: input.force,
            ...(input.resourceId === "" ? {} : { p_resource: input.resourceId }),
        }),
    )
    if (answer.kind !== "ok") return answer
    const placement = toPlacement(answer.value)
    if (placement.ok) revalidatePath("/", "layout")
    return dbOk(placement)
}

/** Moves a booking to another time and/or place. The database refuses a place that is taken unless forced. */
export const writeBookingMove = async (input: BookingMoveInput): Promise<DbOutcome<BookingPlacement>> => {
    if ((await getPrincipal()).kind !== "ok") return dbFailure("refused", "principal")
    if (!UUID.test(input.workspaceId) || !UUID.test(input.id) || Number.isNaN(Date.parse(input.startAt))) {
        return dbFailure("invalid", "booking-move")
    }
    if (input.resourceId !== "" && !UUID.test(input.resourceId)) return dbFailure("invalid", "booking-move")
    const db = await createServerDbClient()
    const answer = toOutcome(
        await db.rpc("desk_booking_move", {
            p_workspace: input.workspaceId,
            p_booking: input.id,
            p_start: new Date(input.startAt).toISOString(),
            p_force: input.force,
            ...(input.resourceId === "" ? {} : { p_resource: input.resourceId }),
        }),
    )
    if (answer.kind !== "ok") return answer
    const placement = toPlacement(answer.value)
    if (placement.ok) revalidatePath("/", "layout")
    return dbOk(placement)
}
