import type { Database } from "../../../../../../../supabase/types/database.types"
import { iso, numberOrNull, tally } from "./admin.mapper"
import type { AdminCount, AdminHealth } from "./admin.mapper"

type Tables = Database["public"]["Tables"]

/** The rows the health page is built from. */
export interface HealthInput {
    readonly signups: ReadonlyArray<{ readonly day: string; readonly signups: number }>
    readonly transfers: ReadonlyArray<
        Pick<Tables["sepay_transactions"]["Row"], "status" | "transfer_amount" | "content" | "received_at">
    >
    readonly billingEvents: ReadonlyArray<
        Pick<Tables["billing_events"]["Row"], "id" | "workspace_id" | "kind" | "created_at">
    >
    readonly errors: ReadonlyArray<
        Pick<Tables["app_errors"]["Row"], "id" | "scope" | "message" | "workspace_id" | "created_at">
    >
    readonly recentErrors: ReadonlyArray<Pick<Tables["app_errors"]["Row"], "scope">>
    readonly audits: ReadonlyArray<
        Pick<Tables["platform_audit"]["Row"], "id" | "actor_email" | "action" | "workspace_id" | "created_at">
    >
    readonly names: ReadonlyArray<{ readonly id: string; readonly name: string }>
}

/** The workspace ids the health rows mention, once each. */
export const referencedWorkspaces = (
    input: Pick<HealthInput, "billingEvents" | "errors" | "audits">,
): Array<string> => [
    ...new Set(
        [
            ...[...input.errors, ...input.billingEvents].map((row) => row.workspace_id),
            ...input.audits.map((audit) => audit.workspace_id),
        ].filter((id): id is string => id !== null),
    ),
]

const scopesOf = (rows: ReadonlyArray<{ readonly scope: string }>): Array<AdminCount> =>
    tally(rows.map((row) => row.scope)).sort(
        (left, right) => right.count - left.count || left.key.localeCompare(right.key),
    )

/** Builds the platform health page. */
export const healthOf = (input: HealthInput): AdminHealth => ({
    signups: input.signups.map((row) => ({ day: row.day, signups: row.signups })),
    transfers: input.transfers.map((row) => ({
        status: row.status,
        transferAmount: numberOrNull(row.transfer_amount),
        content: row.content,
        receivedAt: iso(row.received_at),
    })),
    transferCounts: tally(input.transfers.map((row) => row.status)),
    billingEvents: input.billingEvents.map((row) => ({
        id: row.id,
        workspaceId: row.workspace_id,
        kind: row.kind,
        createdAt: iso(row.created_at),
    })),
    errors: input.errors.map((row) => ({
        id: row.id,
        scope: row.scope,
        message: row.message,
        workspaceId: row.workspace_id,
        createdAt: iso(row.created_at),
    })),
    errorScopes: scopesOf(input.recentErrors),
    audits: input.audits.map((row) => ({
        id: row.id,
        actorEmail: row.actor_email,
        action: row.action,
        workspaceId: row.workspace_id,
        createdAt: iso(row.created_at),
    })),
    workspaceNames: input.names,
})
