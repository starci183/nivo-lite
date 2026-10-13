import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the credits capability. */
export enum CreditsErrorCode {
    /** No active pack has the requested code. */
    PackNotFound = "CREDITS_PACK_NOT_FOUND",
    /** The workspace is not active, or has no plan to buy credits for. */
    WorkspaceNotActive = "CREDITS_WORKSPACE_NOT_ACTIVE",
    /** The plan of the workspace is not in the catalogue. */
    PlanNotFound = "CREDITS_PLAN_NOT_FOUND",
    /** The target is not a higher self-serve plan. */
    NotUpgrade = "CREDITS_NOT_UPGRADE",
    /** The paid period is over, so the workspace has to renew before it upgrades. */
    RenewFirst = "CREDITS_RENEW_FIRST",
    /** Nothing to charge: the upgrade is switched by hand. */
    ZeroAmount = "CREDITS_ZERO_AMOUNT",
    /** The plan is sold with add-on packs, so the old top-up packs are not sold to it. */
    UsePacks = "CREDITS_USE_PACKS",
}

/** How each credits code travels. */
export const CREDITS_ERROR_KINDS: Record<CreditsErrorCode, ErrorKind> = {
    [CreditsErrorCode.PackNotFound]: "not-found",
    [CreditsErrorCode.WorkspaceNotActive]: "conflict",
    [CreditsErrorCode.PlanNotFound]: "not-found",
    [CreditsErrorCode.NotUpgrade]: "conflict",
    [CreditsErrorCode.RenewFirst]: "conflict",
    [CreditsErrorCode.ZeroAmount]: "conflict",
    [CreditsErrorCode.UsePacks]: "conflict",
}

/** The one error class of the credits capability. */
export class CreditsError extends DomainError<CreditsErrorCode> {}
