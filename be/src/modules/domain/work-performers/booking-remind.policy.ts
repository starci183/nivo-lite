import type { WorkItem } from "@modules/domain/decisions"

/** The statuses of a booking that still expects the customer: a reminder is for these only. */
export const LIVE_BOOKING_STATUSES: ReadonlyArray<string> = ["requested", "confirmed", "rescheduled"]

/** Where a taken reminder stands once its work item went through the gate. */
export const settlementOf = (status: WorkItem["status"]): "sent" | "waiting" | "skipped" | "failed" => {
    if (status === "done") return "sent"
    if (status === "waiting_decision") return "waiting"
    return status === "rejected" ? "skipped" : "failed"
}

/** How the owner reaches the customer on the card: the phone, else the email, else the chat. */
export const contactOf = (phone: string | null, email: string | null, chat: string): string => phone ?? email ?? chat
