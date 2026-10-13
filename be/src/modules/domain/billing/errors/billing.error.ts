import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the billing capability. */
export enum BillingErrorCode {
    /** The caller is not an owner or manager of the workspace. */
    Forbidden = "BILLING_FORBIDDEN",
    /** The caller is not a member of the workspace. */
    NotMember = "BILLING_NOT_MEMBER",
    /** The workspace does not exist or has no plan to bill. */
    WorkspaceNotFound = "BILLING_WORKSPACE_NOT_FOUND",
    /** No active plan has the requested code. */
    PlanNotFound = "BILLING_PLAN_NOT_FOUND",
    /** The plan is a contract plan that is never bought in the app. */
    PlanCustom = "BILLING_PLAN_CUSTOM",
    /** A webhook delivery did not prove who sent it. */
    WebhookUnauthorized = "BILLING_WEBHOOK_UNAUTHORIZED",
    /** A webhook delivery body cannot be used. */
    WebhookInvalid = "BILLING_WEBHOOK_INVALID",
    /** The door has no workspace configured, so it cannot book anything. */
    FeedNotConfigured = "BILLING_FEED_NOT_CONFIGURED",
    /** A stored connection credential cannot be decrypted. */
    CredentialUnreadable = "BILLING_CREDENTIAL_UNREADABLE",
}

/** How each billing code travels. */
export const BILLING_ERROR_KINDS: Record<BillingErrorCode, ErrorKind> = {
    [BillingErrorCode.Forbidden]: "forbidden",
    [BillingErrorCode.NotMember]: "forbidden",
    [BillingErrorCode.WorkspaceNotFound]: "not-found",
    [BillingErrorCode.PlanNotFound]: "not-found",
    [BillingErrorCode.PlanCustom]: "conflict",
    [BillingErrorCode.WebhookUnauthorized]: "unauthenticated",
    [BillingErrorCode.WebhookInvalid]: "invalid",
    [BillingErrorCode.FeedNotConfigured]: "unavailable",
    [BillingErrorCode.CredentialUnreadable]: "internal",
}

/** The one error class of the billing capability. */
export class BillingError extends DomainError<BillingErrorCode> {}
