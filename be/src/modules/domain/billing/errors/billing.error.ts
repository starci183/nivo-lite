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
    /** A stored connection credential cannot be decrypted. */
    CredentialUnreadable = "BILLING_CREDENTIAL_UNREADABLE",
    /** The plan is no longer sold: only the workspaces that already have it keep it. */
    PlanNotListed = "BILLING_PLAN_NOT_LISTED",
    /** The plan is not sold for the billing cycle asked for. */
    CycleUnavailable = "BILLING_CYCLE_UNAVAILABLE",
    /** The usage tier asked for does not exist on the plan. */
    TierUnknown = "BILLING_TIER_UNKNOWN",
    /** A per-seat plan is bought with a usage tier. */
    TierRequired = "BILLING_TIER_REQUIRED",
    /** The seat count is outside what the plan allows. */
    SeatsInvalid = "BILLING_SEATS_INVALID",
    /** The workspace is on an individual plan, which takes no other members. */
    PlanIndividualOnly = "BILLING_PLAN_INDIVIDUAL_ONLY",
    /** Every paid seat of the workspace is taken. */
    SeatLimitReached = "BILLING_SEAT_LIMIT_REACHED",
    /** The plan's storage is full. */
    StorageQuotaExceeded = "BILLING_STORAGE_QUOTA_EXCEEDED",
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
    [BillingErrorCode.CredentialUnreadable]: "internal",
    [BillingErrorCode.PlanNotListed]: "conflict",
    [BillingErrorCode.CycleUnavailable]: "invalid",
    [BillingErrorCode.TierUnknown]: "invalid",
    [BillingErrorCode.TierRequired]: "invalid",
    [BillingErrorCode.SeatsInvalid]: "invalid",
    [BillingErrorCode.PlanIndividualOnly]: "forbidden",
    [BillingErrorCode.SeatLimitReached]: "conflict",
    [BillingErrorCode.StorageQuotaExceeded]: "conflict",
}

/** The one error class of the billing capability. */
export class BillingError extends DomainError<BillingErrorCode> {}
