import type {
    AdminBillingEvent,
    AdminConnection,
    AdminError,
    AdminInvite,
    AdminMember,
    AdminOrder,
    AdminPlatformBillingEvent,
    AdminPlatformError,
    AdminPlatformTransfer,
    AdminSignupDay,
    AdminTransfer,
} from "./platform-admin.contracts"
import type {
    BillingEventRow,
    ConnectionRow,
    InviteRow,
    MemberRow,
    OrderRow,
    RecentBillingEventRow,
    RecentErrorRow,
    RecentTransferRow,
    SignupRow,
    TransferRow,
    WorkspaceErrorRow,
} from "./persistence/platform-admin.rows"
import { connectionHealth, numberOrNull } from "./platform-admin.policy"

/** An instant as ISO 8601 text, whether the driver answered a Date or text. */
export const iso = (value: string): string => new Date(value).toISOString()

/** An instant as ISO 8601 text, or null. */
export const isoOrNull = (value: string | null): string | null => (value === null ? null : iso(value))

/** Maps a member row; the email comes from Auth and may be unknown. */
export const toMember = (row: MemberRow, email: string | null): AdminMember => ({
    userId: row.user_id,
    role: row.role,
    displayName: row.display_name,
    status: row.status,
    email,
})

/** Maps a pending invitation row. */
export const toInvite = (row: InviteRow): AdminInvite => ({
    id: row.id,
    email: row.email,
    role: row.role,
    createdAt: iso(row.created_at),
    expiresAt: iso(row.expires_at),
})

/** Maps a payment order row. */
export const toOrder = (row: OrderRow): AdminOrder => ({
    id: row.id,
    orderCode: row.order_code,
    planCode: row.plan_code,
    amountVnd: Number(row.amount_vnd),
    status: row.status,
    createdAt: iso(row.created_at),
    paidAt: isoOrNull(row.paid_at),
})

/** Maps a SePay transfer row of a workspace's orders. */
export const toTransfer = (row: TransferRow): AdminTransfer => ({
    sepayId: Number(row.sepay_id),
    transferAmount: numberOrNull(row.transfer_amount),
    content: row.content,
    status: row.status,
    receivedAt: iso(row.received_at),
})

/** Maps a billing event row of a workspace. */
export const toBillingEvent = (row: BillingEventRow): AdminBillingEvent => ({
    id: row.id,
    kind: row.kind,
    createdAt: iso(row.created_at),
})

/** Maps a connection row, judging its health at `nowMs`. */
export const toConnection = (row: ConnectionRow, nowMs: number): AdminConnection => ({
    id: row.id,
    provider: row.provider,
    name: row.name,
    status: row.status,
    environment: row.environment ?? "live",
    lastEventAt: isoOrNull(row.last_event_at),
    lastError: row.last_error,
    health: connectionHealth(
        { status: row.status, environment: row.environment, lastEventAt: row.last_event_at, createdAt: row.created_at },
        nowMs,
    ),
})

/** Maps a captured error row of a workspace. */
export const toError = (row: WorkspaceErrorRow): AdminError => ({
    id: row.id,
    scope: row.scope,
    message: row.message,
    createdAt: iso(row.created_at),
})

/** Maps a sign-up day row. */
export const toSignupDay = (row: SignupRow): AdminSignupDay => ({ day: row.day, signups: row.signups })

/** Maps a platform SePay transfer row. */
export const toPlatformTransfer = (row: RecentTransferRow): AdminPlatformTransfer => ({
    status: row.status,
    transferAmount: numberOrNull(row.transfer_amount),
    content: row.content,
    receivedAt: iso(row.received_at),
})

/** Maps a platform billing event row. */
export const toPlatformBillingEvent = (row: RecentBillingEventRow): AdminPlatformBillingEvent => ({
    id: row.id,
    workspaceId: row.workspace_id,
    kind: row.kind,
    createdAt: iso(row.created_at),
})

/** Maps a platform error row. */
export const toPlatformError = (row: RecentErrorRow): AdminPlatformError => ({
    id: row.id,
    scope: row.scope,
    message: row.message,
    workspaceId: row.workspace_id,
    createdAt: iso(row.created_at),
})
