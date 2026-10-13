"use server"
import "server-only"

import { revalidatePath } from "next/cache"
import type { BookingAction } from "@/modules/types"
import { getPrincipal } from "../principal"
import { dbFailure, dbOk, toOutcome } from "../outcome"
import type { DbOutcome } from "../outcome"
import { createServerDbClient } from "../server"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

/** What each action changes and the statuses it may start from. */
const TRANSITIONS: Readonly<
    Record<
        BookingAction,
        { readonly from: ReadonlyArray<string>; readonly change: (now: string) => Record<string, unknown> }
    >
> = {
    confirm: { from: ["requested"], change: () => ({ status: "confirmed", holds_slot: true }) },
    "check-in": { from: ["confirmed", "rescheduled"], change: (now) => ({ checked_in_at: now }) },
    done: { from: ["confirmed", "rescheduled"], change: (now) => ({ status: "done", done_at: now }) },
    "no-show": { from: ["confirmed", "rescheduled"], change: () => ({ status: "no_show" }) },
    cancel: {
        from: ["requested", "confirmed", "rescheduled"],
        change: (now) => ({ status: "cancelled", holds_slot: false, cancelled_at: now, cancel_reason: "owner" }),
    },
}

/** The actions after which no reminder is due any more. */
const ENDS_REMINDERS: ReadonlyArray<BookingAction> = ["done", "no-show", "cancel"]

/** Changes the status of one booking as the signed-in manager (row level security decides who may) and stops its reminders when it ends. */
export const writeBookingStatus = async (
    workspaceId: string,
    id: string,
    action: BookingAction,
): Promise<DbOutcome<true>> => {
    if ((await getPrincipal()).kind !== "ok") return dbFailure("refused", "principal")
    const transition = TRANSITIONS[action]
    if (!UUID.test(workspaceId) || !UUID.test(id)) return dbFailure("invalid", "booking-input")
    const now = new Date().toISOString()
    const db = await createServerDbClient()
    const changed = toOutcome(
        await db
            .from("bookings")
            .update({ ...transition.change(now), updated_at: now })
            .eq("id", id)
            .eq("workspace_id", workspaceId)
            .in("status", [...transition.from])
            .select("id"),
    )
    if (changed.kind !== "ok") return changed
    if (changed.value.length === 0) return dbFailure("invalid", "booking-state")
    if (ENDS_REMINDERS.includes(action)) {
        const stopped = toOutcome(
            await db
                .from("booking_reminders")
                .update({ status: "cancelled" })
                .eq("booking_id", id)
                .eq("workspace_id", workspaceId)
                .eq("status", "pending")
                .select("id"),
        )
        if (stopped.kind !== "ok") return stopped
    }
    revalidatePath("/", "layout")
    return dbOk(true)
}
