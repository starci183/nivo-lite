import type {
    AdminCount,
    AdminPlatformBillingEvent,
    AdminPlatformError,
    AdminPlatformTransfer,
    AdminSignupDay,
    AdminWorkspaceName,
} from "@modules/domain/platform-admin"
import type { AuditSummary } from "@modules/domain/platform-audit"

/** The HTTP response of getPlatformHealth. */
export class GetPlatformHealthResponse {
    /** Sign-ups per day. */
    signups!: ReadonlyArray<AdminSignupDay>

    /** The newest SePay transfers. */
    transfers!: ReadonlyArray<AdminPlatformTransfer>

    /** The newest transfers counted by status. */
    transferCounts!: ReadonlyArray<AdminCount>

    /** The newest billing events. */
    billingEvents!: ReadonlyArray<AdminPlatformBillingEvent>

    /** The newest application errors. */
    errors!: ReadonlyArray<AdminPlatformError>

    /** The errors of the last 24 hours by scope. */
    errorScopes!: ReadonlyArray<AdminCount>

    /** The latest console activity. */
    audits!: ReadonlyArray<AuditSummary>

    /** The names of the workspaces the page links to. */
    workspaceNames!: ReadonlyArray<AdminWorkspaceName>
}
