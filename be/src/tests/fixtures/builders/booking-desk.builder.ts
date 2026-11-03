import type { WorkspaceMember } from "@modules/domain/workspace-members"

/** The workspace the desk specs run in. */
export const WORKSPACE = "ws-1"

/** Wednesday 12:00 in Ho Chi Minh City. */
export const NOW: number = Date.UTC(2026, 9, 14, 5, 0)

/** The owner who runs the desk in the specs. */
export const DESK_OWNER: WorkspaceMember = {
    userId: "user-1",
    workspaceId: WORKSPACE,
    role: "owner",
    staffId: null,
    displayName: "Owner",
    status: "active",
}

/** One hour in milliseconds. */
const HOUR = 3_600_000

/** Thursday 15 October 2026, 09:00 in Ho Chi Minh City. */
export const THURSDAY_NINE: number = Date.UTC(2026, 9, 15, 2, 0)

type AddedBookingShape = {
    readonly workspaceId: "ws-1"
    readonly customerName: "Mai"
    readonly customerPhone: "84912345678"
    readonly customerEmail: null
    readonly serviceId: "s1"
    readonly resourceId: "r1"
    readonly startMs: number
    readonly endMs: number
    readonly blockEndMs: number
    readonly partySize: 1
    readonly status: "confirmed"
    readonly holdsSlot: true
    readonly sourceChannel: "manual"
    readonly priceVnd: 200000
    readonly depositVnd: 0
    readonly depositStatus: "none"
    readonly note: "walk-in"
    readonly conflictNote: ""
    readonly idempotencyKey: null
}

/** The booking the desk writes when the owner adds Mai for a cut at nine, unforced and without a deposit. */
export const ADDED_BOOKING: AddedBookingShape = {
    workspaceId: WORKSPACE,
    customerName: "Mai",
    customerPhone: "84912345678",
    customerEmail: null,
    serviceId: "s1",
    resourceId: "r1",
    startMs: THURSDAY_NINE,
    endMs: THURSDAY_NINE + HOUR,
    blockEndMs: THURSDAY_NINE + HOUR + HOUR / 2,
    partySize: 1,
    status: "confirmed",
    holdsSlot: true,
    sourceChannel: "manual",
    priceVnd: 200000,
    depositVnd: 0,
    depositStatus: "none",
    note: "walk-in",
    conflictNote: "",
    idempotencyKey: null,
} as const
