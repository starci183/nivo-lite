import "server-only"

import { shiftDate, wallDate, wallInstant, weekStartOf } from "@/modules/i18n"
import { createServerDbClient } from "../server"
import { dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { boardOf } from "./booking.mapper"
import type { BookingBoard } from "@/modules/types"

/** The local dates a board is read for; the week of today when none is given. */
export interface BoardRange {
    readonly from: string
    readonly to: string
}

const FIRST_MINUTE = "00:00"

/** Reads the model, the bookings of a range, the waiting list and the staff of a workspace under the caller RLS; one request. */
export const readBookingBoard = async (
    workspaceId: string,
    range: BoardRange | null,
): Promise<DbOutcome<BookingBoard>> => {
    const client = await createServerDbClient()
    const settings = toOutcome(
        await client.from("booking_settings").select("*").eq("workspace_id", workspaceId).limit(1),
    )
    if (settings.kind !== "ok") return settings
    const nowMs = Date.now()
    const timezone = settings.value[0]?.timezone ?? "Asia/Ho_Chi_Minh"
    const today = wallDate(nowMs, timezone)
    const window = range ?? { from: weekStartOf(today), to: shiftDate(weekStartOf(today), 6) }
    const fromMs = wallInstant(window.from, FIRST_MINUTE, timezone)
    const toMs = wallInstant(shiftDate(window.to, 1), FIRST_MINUTE, timezone)
    const [services, resources, hours, exceptions, bookings, waitlist, staff, finished, deposits] = await Promise.all([
        client
            .from("booking_services")
            .select("*")
            .eq("workspace_id", workspaceId)
            .order("sort_order")
            .order("name")
            .limit(200),
        client.from("booking_resources").select("*").eq("workspace_id", workspaceId).order("sort_order").limit(200),
        client.from("booking_hours").select("*").eq("workspace_id", workspaceId).limit(2000),
        client
            .from("booking_exceptions")
            .select("*")
            .eq("workspace_id", workspaceId)
            .gte("on_date", shiftDate(today, -1))
            .order("on_date")
            .limit(200),
        client
            .from("bookings")
            .select("*")
            .eq("workspace_id", workspaceId)
            .lt("start_at", new Date(toMs).toISOString())
            .gt("end_at", new Date(fromMs).toISOString())
            .order("start_at")
            .limit(2000),
        client
            .from("booking_waitlist")
            .select("*")
            .eq("workspace_id", workspaceId)
            .in("status", ["waiting", "notified"])
            .order("created_at", { ascending: false })
            .limit(100),
        client
            .from("staff")
            .select("id, name")
            .eq("workspace_id", workspaceId)
            .eq("active", true)
            .order("name")
            .limit(200),
        client
            .from("bookings")
            .select("status")
            .eq("workspace_id", workspaceId)
            .in("status", ["done", "no_show"])
            .gte("start_at", new Date(nowMs - 30 * 86_400_000).toISOString())
            .lt("start_at", new Date(nowMs).toISOString())
            .limit(5000),
        client
            .from("bookings")
            .select("deposit_vnd")
            .eq("workspace_id", workspaceId)
            .eq("deposit_status", "due")
            .in("status", ["requested", "confirmed", "rescheduled"])
            .limit(5000),
    ])
    const servicesOut = toOutcome(services)
    if (servicesOut.kind !== "ok") return servicesOut
    const resourcesOut = toOutcome(resources)
    if (resourcesOut.kind !== "ok") return resourcesOut
    const hoursOut = toOutcome(hours)
    if (hoursOut.kind !== "ok") return hoursOut
    const exceptionsOut = toOutcome(exceptions)
    if (exceptionsOut.kind !== "ok") return exceptionsOut
    const bookingsOut = toOutcome(bookings)
    if (bookingsOut.kind !== "ok") return bookingsOut
    const waitlistOut = toOutcome(waitlist)
    if (waitlistOut.kind !== "ok") return waitlistOut
    const staffOut = toOutcome(staff)
    if (staffOut.kind !== "ok") return staffOut
    const finishedOut = toOutcome(finished)
    if (finishedOut.kind !== "ok") return finishedOut
    const depositsOut = toOutcome(deposits)
    if (depositsOut.kind !== "ok") return depositsOut
    return dbOk(
        boardOf(
            {
                settings: settings.value[0] ?? null,
                services: servicesOut.value,
                resources: resourcesOut.value,
                hours: hoursOut.value,
                exceptions: exceptionsOut.value,
                bookings: bookingsOut.value,
                waitlist: waitlistOut.value,
                staff: staffOut.value,
                finished: finishedOut.value,
                deposits: depositsOut.value,
            },
            window.from,
            window.to,
            nowMs,
        ),
    )
}
