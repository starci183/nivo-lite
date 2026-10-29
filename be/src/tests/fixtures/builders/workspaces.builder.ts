import { entityRowBuilder } from "./entity-row.builder"

/** A stored workspace as the workspaces table holds it. */
export interface WorkspaceRow {
    readonly id: string
    readonly ownerId: string
    readonly name: string
    readonly createdAt: Date
    readonly status: "pending_payment" | "active" | "past_due" | "cancelled"
    readonly planCode: string | null
    readonly paidUntil: Date | null
    readonly businessType: string | null
    readonly tierCredits: string | null
    readonly seatCount: number | null
    readonly billingCycle: "monthly" | "annual" | null
    readonly billedMonthlyVnd: string | null
    readonly displayName: string | null
    readonly logoUrl: string | null
}

/** Workspace `ws-1`, the cafe Quan Ca Phe owned by `owner-1`; the arguments of a case change what it needs. */
export const workspaceRow = entityRowBuilder<WorkspaceRow>({
    id: "ws-1",
    ownerId: "owner-1",
    name: "Quan Ca Phe",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    status: "active",
    planCode: null,
    paidUntil: null,
    businessType: "cafe",
    tierCredits: null,
    seatCount: null,
    billingCycle: null,
    billedMonthlyVnd: null,
    displayName: null,
    logoUrl: null,
})

/** A workspace the person owns, by id and status. */
export const ownedWorkspaceRow = (id: string, status: WorkspaceRow["status"] = "active"): WorkspaceRow =>
    workspaceRow({ id, status })
