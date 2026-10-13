"use server"
import "server-only"

import { revalidatePath } from "next/cache"
import { getPrincipal } from "../principal"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome, SupabaseResult } from "../outcome"
import { createServerDbClient } from "../server"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu
const DATE = /^\d{4}-\d{2}-\d{2}$/u
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/u

/** A service the owner saves; no id adds one. */
interface ServiceInput {
    readonly workspaceId: string
    readonly id: string | null
    readonly name: string
    readonly description: string
    readonly durationMin: number
    readonly bufferMin: number
    readonly priceVnd: number | null
    readonly resourceKind: string
    readonly followupDays: number | null
    readonly active: boolean
}

/** A person, room or chair the owner saves; no id adds one. */
interface ResourceInput {
    readonly workspaceId: string
    readonly id: string | null
    readonly name: string
    readonly kind: string
    readonly capacity: number
    readonly active: boolean
    readonly staffId: string | null
}

/** A closing or a special opening on one date; no resource means the whole business. */
interface ExceptionInput {
    readonly workspaceId: string
    readonly resourceId: string | null
    readonly date: string
    readonly closed: boolean
    readonly start: string
    readonly end: string
    readonly note: string
}

/** One weekly opening window. */
interface HoursRow {
    readonly weekday: number
    readonly start: string
    readonly end: string
}

const whole = (value: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, Number.isFinite(value) ? Math.round(value) : min))

/** Refuses a caller that is signed out or names an id that is not one; null when the write may go on. */
const refuse = async (ids: ReadonlyArray<string>): Promise<DbOutcome<true> | null> => {
    if ((await getPrincipal()).kind !== "ok") return dbFailure("refused", "principal")
    return ids.every((id) => UUID.test(id)) ? null : dbFailure("invalid", "booking-input")
}

/** Turns the answer of a write into the success of the action, refreshing every screen that shows bookings. */
const finish = (saved: DbOutcome<unknown>): DbOutcome<true> => {
    if (saved.kind !== "ok") return saved
    revalidatePath("/", "layout")
    return dbOk(true)
}

/** Deletes a row nothing uses; a row that bookings use is only stopped, so the history keeps its names. */
const removeOrStop = async (
    usage: PromiseLike<SupabaseResult>,
    stop: () => PromiseLike<SupabaseResult>,
    remove: () => PromiseLike<SupabaseResult>,
): Promise<DbOutcome<true>> => {
    const seen = toOutcome(await usage)
    if (seen.kind !== "ok") return seen
    return finish(toOutcome(await (Array.isArray(seen.value) && seen.value.length > 0 ? stop() : remove())))
}

/** Adds or changes a service of the workspace. */
export const writeBookingService = async (input: ServiceInput): Promise<DbOutcome<true>> => {
    const refused = await refuse(input.id === null ? [input.workspaceId] : [input.workspaceId, input.id])
    if (refused !== null) return refused
    if (input.name.trim() === "") return dbFailure("invalid", "booking-service")
    const row = {
        workspace_id: input.workspaceId,
        name: input.name.trim().slice(0, 160),
        description: input.description.trim().slice(0, 600),
        duration_min: whole(input.durationMin, 5, 1440),
        buffer_min: whole(input.bufferMin, 0, 480),
        price_vnd: input.priceVnd === null ? null : whole(input.priceVnd, 0, 1_000_000_000),
        resource_kind: input.resourceKind.trim() === "" ? null : input.resourceKind.trim().slice(0, 40),
        followup_days: input.followupDays === null || input.followupDays < 1 ? null : whole(input.followupDays, 1, 730),
        active: input.active,
    }
    const db = await createServerDbClient()
    const table = db.from("booking_services")
    return finish(
        toOutcome(
            input.id === null
                ? await table.insert(row).select("id")
                : await table.update(row).eq("id", input.id).eq("workspace_id", input.workspaceId).select("id"),
        ),
    )
}

/** Adds or changes a resource; a new one starts open Monday to Saturday so it can take bookings at once. */
export const writeBookingResource = async (input: ResourceInput): Promise<DbOutcome<true>> => {
    const refused = await refuse(input.id === null ? [input.workspaceId] : [input.workspaceId, input.id])
    if (refused !== null) return refused
    if (input.name.trim() === "") return dbFailure("invalid", "booking-resource")
    const row = {
        workspace_id: input.workspaceId,
        name: input.name.trim().slice(0, 120),
        kind: input.kind.trim().slice(0, 40) || "staff",
        capacity: whole(input.capacity, 1, 200),
        active: input.active,
        staff_id: input.staffId !== null && UUID.test(input.staffId) ? input.staffId : null,
    }
    const db = await createServerDbClient()
    const table = db.from("booking_resources")
    if (input.id !== null) {
        return finish(
            toOutcome(await table.update(row).eq("id", input.id).eq("workspace_id", input.workspaceId).select("id")),
        )
    }
    const created = toOutcome(await table.insert(row).select("id"))
    const first = created.kind === "ok" ? created.value[0] : undefined
    if (first === undefined) return created.kind === "ok" ? dbFailure("unavailable", "booking-resource") : created
    const days = [1, 2, 3, 4, 5, 6]
    return finish(
        toOutcome(
            await db
                .from("booking_hours")
                .insert(
                    days.map((weekday) => ({
                        workspace_id: input.workspaceId,
                        resource_id: first.id,
                        weekday,
                        start_time: "09:00",
                        end_time: "18:00",
                    })),
                )
                .select("id"),
        ),
    )
}

/** The two catalogs whose rows bookings can use. */
const OWNED = { booking_services: "service_id", booking_resources: "resource_id" } as const

/** Deletes a service or a resource, or only stops it when bookings already use it. */
export const writeBookingCatalogRemoval = async (
    workspaceId: string,
    id: string,
    table: keyof typeof OWNED,
): Promise<DbOutcome<true>> => {
    const refused = await refuse([workspaceId, id])
    if (refused !== null) return refused
    const db = await createServerDbClient()
    return removeOrStop(
        db.from("bookings").select("id").eq("workspace_id", workspaceId).eq(OWNED[table], id).limit(1),
        () => db.from(table).update({ active: false }).eq("id", id).eq("workspace_id", workspaceId).select("id"),
        () => db.from(table).delete().eq("id", id).eq("workspace_id", workspaceId).select("id"),
    )
}

/** Replaces the weekly opening windows of one resource. */
export const writeBookingHours = async (
    workspaceId: string,
    resourceId: string,
    rows: ReadonlyArray<HoursRow>,
): Promise<DbOutcome<true>> => {
    const refused = await refuse([workspaceId, resourceId])
    if (refused !== null) return refused
    const bad = rows.some(
        (row) =>
            row.weekday < 1 ||
            row.weekday > 7 ||
            !CLOCK.test(row.start) ||
            !CLOCK.test(row.end) ||
            row.end <= row.start,
    )
    if (bad) return dbFailure("invalid", "booking-hours")
    const db = await createServerDbClient()
    const cleared = await db
        .from("booking_hours")
        .delete()
        .eq("workspace_id", workspaceId)
        .eq("resource_id", resourceId)
    if (cleared.error !== null) return toOutcome(cleared)
    if (rows.length === 0) return finish(dbOk(true))
    return finish(
        toOutcome(
            await db
                .from("booking_hours")
                .insert(
                    rows.map((row) => ({
                        workspace_id: workspaceId,
                        resource_id: resourceId,
                        weekday: row.weekday,
                        start_time: row.start,
                        end_time: row.end,
                    })),
                )
                .select("id"),
        ),
    )
}

/** Adds a closing or a special opening hours on one date. */
export const writeBookingException = async (input: ExceptionInput): Promise<DbOutcome<true>> => {
    const refused = await refuse(
        input.resourceId === null ? [input.workspaceId] : [input.workspaceId, input.resourceId],
    )
    if (refused !== null) return refused
    const hours = !input.closed && (!CLOCK.test(input.start) || !CLOCK.test(input.end) || input.end <= input.start)
    if (!DATE.test(input.date) || hours) return dbFailure("invalid", "booking-exception")
    const db = await createServerDbClient()
    return finish(
        toOutcome(
            await db
                .from("booking_exceptions")
                .insert({
                    workspace_id: input.workspaceId,
                    resource_id: input.resourceId,
                    on_date: input.date,
                    closed: input.closed,
                    start_time: input.closed ? null : input.start,
                    end_time: input.closed ? null : input.end,
                    note: input.note.trim().slice(0, 200),
                })
                .select("id"),
        ),
    )
}

/** Removes a closing or special opening hours. */
export const writeBookingExceptionRemoval = async (workspaceId: string, id: string): Promise<DbOutcome<true>> => {
    const refused = await refuse([workspaceId, id])
    if (refused !== null) return refused
    const db = await createServerDbClient()
    return finish(
        toOutcome(
            await db.from("booking_exceptions").delete().eq("id", id).eq("workspace_id", workspaceId).select("id"),
        ),
    )
}

/** Takes a customer off the waiting list. */
export const writeBookingWaitRemoval = async (workspaceId: string, id: string): Promise<DbOutcome<true>> => {
    const refused = await refuse([workspaceId, id])
    if (refused !== null) return refused
    const db = await createServerDbClient()
    return finish(
        toOutcome(
            await db
                .from("booking_waitlist")
                .update({ status: "cancelled" })
                .eq("id", id)
                .eq("workspace_id", workspaceId)
                .select("id"),
        ),
    )
}
