import type { WorkspaceMember } from "@modules/domain/workspace-members"

/** The workspace the desk specs run in. */
export const WORKSPACE = "ws-1"

/** Wednesday 12:00 in Ho Chi Minh City. */
export const NOW = Date.UTC(2026, 9, 14, 5, 0)

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
export const THURSDAY_NINE = Date.UTC(2026, 9, 15, 2, 0)

/** The booking the desk writes when the owner adds Mai for a cut at nine, unforced and without a deposit. */
export const ADDED_BOOKING = {
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
