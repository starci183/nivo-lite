import type { Access, Purpose } from "./connections"

/** A dashboard region can fail independently of the rest of the page. */
export type DashboardRegion<T> = { readonly status: "ready"; readonly data: T } | { readonly status: "failed" }

/** A decision waiting for a person, or a completed action. */
export type DashboardRow = {
    readonly id: string
    readonly title: string
    readonly description?: string
    readonly at: string | null
    readonly href: string
}

/** The oldest open decisions and their total count. */
export type DashboardWaiting = { readonly total: number; readonly items: ReadonlyArray<DashboardRow> }

/** The latest actions completed by policy during the past seven days. */
export type DashboardDone = { readonly count: number; readonly items: ReadonlyArray<DashboardRow> }

/** A connection bound to the installed agent. */
export type DashboardConnection = {
    readonly id: string
    readonly name: string
    readonly providerLabel: string
    readonly status: "connected" | "error" | "pending"
    readonly access: Access
    readonly purpose: Purpose
}

/** An unanswered knowledge question. */
export type DashboardGap = {
    readonly id: string
    readonly question: string
    readonly count: number
    readonly lastSeenAt: string
}

/** The agent's knowledge lens and optional open knowledge gaps. */
export type DashboardKnowledge = {
    readonly audience: "customer" | "internal"
    readonly documents: { readonly public: number; readonly internal: number }
    readonly facts: { readonly public: number; readonly internal: number; readonly restricted: number }
    readonly gaps: { readonly openCount: number; readonly items: ReadonlyArray<DashboardGap> } | null
}

/** Pure presentation data of the common agent dashboard regions. */
export type AgentDashboardView = {
    readonly agent: { readonly id: string; readonly name: string; readonly mode: "assist" | "autopilot" } | null
    readonly waiting: DashboardRegion<DashboardWaiting>
    readonly done: DashboardRegion<DashboardDone>
    readonly connections: DashboardRegion<ReadonlyArray<DashboardConnection>>
    readonly knowledge: DashboardRegion<DashboardKnowledge>
}
