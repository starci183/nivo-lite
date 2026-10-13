import type { AuditSummary } from "@modules/domain/platform-audit"
import type { SupportStatus } from "@modules/domain/workspaces"

/** The verified platform admin behind a console request. */
export interface AdminIdentity {
    /** The Auth user id. */
    readonly userId: string
    /** The admin's email, lower-cased. */
    readonly email: string
}

/** The list filters of the console. */
export type WorkspaceFilter = "all" | "attention" | "unpaid" | "idle"

/** What the list asks for: one filter and a free-text search. */
export interface WorkspaceListQuery {
    /** Which workspaces to keep. */
    readonly filter: WorkspaceFilter
    /** Matches the workspace name, the owner's email or the start of its id. */
    readonly query: string
}

/** One agent installation as the list shows it. */
export interface AdminModuleBadge {
    /** The key. */
    readonly key: string
    /** The status. */
    readonly status: string
    /** The live. */
    readonly live: boolean
}

/** The connections of one provider in a workspace, with how many are unhealthy. */
export interface AdminConnectionBadge {
    /** The provider. */
    readonly provider: string
    /** The count. */
    readonly count: number
    /** The error. */
    readonly error: number
    /** The silent. */
    readonly silent: number
}

/** One customer workspace as the list shows it. */
export interface AdminWorkspaceItem {
    /** The id. */
    readonly id: string
    /** The name. */
    readonly name: string
    /** The owner email. */
    readonly ownerEmail: string | null
    /** The status. */
    readonly status: string
    /** The plan code. */
    readonly planCode: string | null
    /** The paid until. */
    readonly paidUntil: string | null
    /** The created at. */
    readonly createdAt: string
    /** The members. */
    readonly members: number
    /** The modules. */
    readonly modules: ReadonlyArray<AdminModuleBadge>
    /** The connections. */
    readonly connections: ReadonlyArray<AdminConnectionBadge>
    /** The connection warning. */
    readonly connectionWarning: boolean
    /** The last customer message at. */
    readonly lastCustomerMessageAt: string | null
    /** The messages7d. */
    readonly messages7d: number
    /** The open decisions. */
    readonly openDecisions: number
    /** The errors24h. */
    readonly errors24h: number
    /** The attention. */
    readonly attention: boolean
    /** The unpaid. */
    readonly unpaid: boolean
    /** The idle7d. */
    readonly idle7d: boolean
}

/** The filtered list with the size of every filter. */
export interface AdminWorkspaceList {
    /** Every workspace, before any filter. */
    readonly total: number
    /** How many workspaces each filter keeps (with no search). */
    readonly counts: Readonly<Record<WorkspaceFilter, number>>
    /** The workspaces the filter and the search keep. */
    readonly items: ReadonlyArray<AdminWorkspaceItem>
}

/** The header facts of one workspace. */
export interface AdminWorkspaceHeader {
    /** The id. */
    readonly id: string
    /** The name. */
    readonly name: string
    /** The owner email. */
    readonly ownerEmail: string | null
    /** The status. */
    readonly status: string
    /** The plan code. */
    readonly planCode: string | null
    /** The paid until. */
    readonly paidUntil: string | null
    /** The created at. */
    readonly createdAt: string
}

/** The month's AI credits against the allowance. */
export interface AdminCredits {
    /** The used. */
    readonly used: number
    /** The limit. */
    readonly limit: number | null
    /** The cost usd. */
    readonly costUsd: number
    /** The own limit. */
    readonly ownLimit: number | null
}

/** One member of the workspace. */
export interface AdminMember {
    /** The user id. */
    readonly userId: string
    /** The role. */
    readonly role: string
    /** The display name. */
    readonly displayName: string
    /** The status. */
    readonly status: string
    /** The email. */
    readonly email: string | null
}

/** One pending invitation. */
export interface AdminInvite {
    /** The id. */
    readonly id: string
    /** The email. */
    readonly email: string
    /** The role. */
    readonly role: string
    /** The created at. */
    readonly createdAt: string
    /** The expires at. */
    readonly expiresAt: string
}

/** One payment order. */
export interface AdminOrder {
    /** The id. */
    readonly id: string
    /** The order code. */
    readonly orderCode: string
    /** The plan code. */
    readonly planCode: string
    /** The amount vnd. */
    readonly amountVnd: number
    /** The status. */
    readonly status: string
    /** The created at. */
    readonly createdAt: string
    /** The paid at. */
    readonly paidAt: string | null
}

/** One SePay transfer matched to an order of the workspace. */
export interface AdminTransfer {
    /** The sepay id. */
    readonly sepayId: number
    /** The transfer amount. */
    readonly transferAmount: number | null
    /** The content. */
    readonly content: string | null
    /** The status. */
    readonly status: string
    /** The received at. */
    readonly receivedAt: string
}

/** One billing event. */
export interface AdminBillingEvent {
    /** The id. */
    readonly id: string
    /** The kind. */
    readonly kind: string
    /** The created at. */
    readonly createdAt: string
}

/** The OpenClaw copy of an agent's context. */
export interface AdminAgentSync {
    /** The agent id. */
    readonly agentId: string
    /** The context version. */
    readonly contextVersion: number | null
    /** The checked at. */
    readonly checkedAt: string
    /** The status. */
    readonly status: string
    /** The error. */
    readonly error: string | null
}

/** One agent installation of the workspace. */
export interface AdminModule {
    /** The id. */
    readonly id: string
    /** The key. */
    readonly key: string
    /** The status. */
    readonly status: string
    /** The operating mode. */
    readonly operatingMode: string
    /** The live. */
    readonly live: boolean
    /** The processor. */
    readonly processor: string
    /** The context version. */
    readonly contextVersion: number | null
    /** The context applied at. */
    readonly contextAppliedAt: string | null
    /** The sync. */
    readonly sync: AdminAgentSync | null
}

/** One connection of the workspace. */
export interface AdminConnection {
    /** The id. */
    readonly id: string
    /** The provider. */
    readonly provider: string
    /** The name. */
    readonly name: string
    /** The status. */
    readonly status: string
    /** The environment. */
    readonly environment: string
    /** The last event at. */
    readonly lastEventAt: string | null
    /** The last error. */
    readonly lastError: string | null
    /** The health. */
    readonly health: string
}

/** One captured application error. */
export interface AdminError {
    /** The id. */
    readonly id: string
    /** The scope. */
    readonly scope: string
    /** The message. */
    readonly message: string
    /** The created at. */
    readonly createdAt: string
}

/** The knowledge sources of one kind, by status. */
export interface AdminKnowledgeKind {
    /** The kind. */
    readonly kind: string
    /** The by status. */
    readonly byStatus: Readonly<Record<string, number>>
}

/** The activity block of a workspace. */
export interface AdminActivity {
    /** The messages7d. */
    readonly messages7d: number
    /** The last customer message at. */
    readonly lastCustomerMessageAt: string | null
    /** The open decisions. */
    readonly openDecisions: number
}

/** The full read-only overview of one workspace. */
export interface AdminWorkspaceDetail {
    /** The workspace. */
    readonly workspace: AdminWorkspaceHeader
    /** The credits. */
    readonly credits: AdminCredits
    /** The members. */
    readonly members: ReadonlyArray<AdminMember>
    /** The invites. */
    readonly invites: ReadonlyArray<AdminInvite>
    /** The orders. */
    readonly orders: ReadonlyArray<AdminOrder>
    /** The transfers. */
    readonly transfers: ReadonlyArray<AdminTransfer>
    /** The billing events. */
    readonly billingEvents: ReadonlyArray<AdminBillingEvent>
    /** The modules. */
    readonly modules: ReadonlyArray<AdminModule>
    /** The connections. */
    readonly connections: ReadonlyArray<AdminConnection>
    /** The errors. */
    readonly errors: ReadonlyArray<AdminError>
    /** The knowledge total. */
    readonly knowledgeTotal: number
    /** The knowledge. */
    readonly knowledge: ReadonlyArray<AdminKnowledgeKind>
    /** The activity. */
    readonly activity: AdminActivity
}

/** Sign-ups on one day. */
export interface AdminSignupDay {
    /** The day. */
    readonly day: string
    /** The signups. */
    readonly signups: number
}

/** One SePay transfer of the platform. */
export interface AdminPlatformTransfer {
    /** The status. */
    readonly status: string
    /** The transfer amount. */
    readonly transferAmount: number | null
    /** The content. */
    readonly content: string | null
    /** The received at. */
    readonly receivedAt: string
}

/** A count by key. */
export interface AdminCount {
    /** The key. */
    readonly key: string
    /** The count. */
    readonly count: number
}

/** One billing event of the platform. */
export interface AdminPlatformBillingEvent {
    /** The id. */
    readonly id: string
    /** The workspace id. */
    readonly workspaceId: string | null
    /** The kind. */
    readonly kind: string
    /** The created at. */
    readonly createdAt: string
}

/** One application error of the platform. */
export interface AdminPlatformError {
    /** The id. */
    readonly id: string
    /** The scope. */
    readonly scope: string
    /** The message. */
    readonly message: string
    /** The workspace id. */
    readonly workspaceId: string | null
    /** The created at. */
    readonly createdAt: string
}

/** The workspace names the health page links to. */
export interface AdminWorkspaceName {
    /** The id. */
    readonly id: string
    /** The name. */
    readonly name: string
}

/** The platform health page. */
export interface AdminHealth {
    /** The signups. */
    readonly signups: ReadonlyArray<AdminSignupDay>
    /** The transfers. */
    readonly transfers: ReadonlyArray<AdminPlatformTransfer>
    /** The transfer counts. */
    readonly transferCounts: ReadonlyArray<AdminCount>
    /** The billing events. */
    readonly billingEvents: ReadonlyArray<AdminPlatformBillingEvent>
    /** The errors. */
    readonly errors: ReadonlyArray<AdminPlatformError>
    /** The error scopes. */
    readonly errorScopes: ReadonlyArray<AdminCount>
    /** The audits. */
    readonly audits: ReadonlyArray<AuditSummary>
    /** The workspace names. */
    readonly workspaceNames: ReadonlyArray<AdminWorkspaceName>
}

/** What extending a subscription answers. */
export interface ExtendedSubscription {
    /** The paid until. */
    readonly paidUntil: string
}

/** What setting the billing status answers. */
export interface StatusSet {
    /** The status now set. */
    readonly status: SupportStatus
}

/** What moving a workspace to a plan answers. */
export interface PlanSet {
    /** The plan code. */
    readonly planCode: string
    /** The credits limit. */
    readonly creditsLimit: number | null
}

/** What resending an invitation from the console answers. */
export interface InviteResent {
    /** The email the invitation was for. */
    readonly email: string
    /** How the invitation reached the person. */
    readonly delivery: "invited" | "existing" | "none"
}
