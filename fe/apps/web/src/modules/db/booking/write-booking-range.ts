"use server"
import "server-only"

import type { BookingBoard } from "@/modules/types"
import { dbFailure } from "../outcome"
import type { DbOutcome } from "../outcome"
import { readBookingBoard } from "./read-booking-board"

const DATE = /^\d{4}-\d{2}-\d{2}$/u
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu

/** Loads the board of another range of local dates on demand, for the calendar that pages to another week. */
export const writeBookingRange = async (
    workspaceId: string,
    from: string,
    to: string,
): Promise<DbOutcome<BookingBoard>> => {
    if (!UUID.test(workspaceId) || !DATE.test(from) || !DATE.test(to)) return dbFailure("invalid", "booking-range")
    return readBookingBoard(workspaceId, { from, to })
}
