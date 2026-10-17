import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the platform-admin capability. */
export enum PlatformAdminErrorCode {
    /** The caller is not on the platform team; the console answers as if it did not exist. */
    NotFound = "PLATFORM_ADMIN_NOT_FOUND",
    /** The workspace does not exist. */
    WorkspaceNotFound = "PLATFORM_ADMIN_WORKSPACE_NOT_FOUND",
}

/** How each platform-admin code travels. */
export const PLATFORM_ADMIN_ERROR_KINDS: Record<PlatformAdminErrorCode, ErrorKind> = {
    [PlatformAdminErrorCode.NotFound]: "not-found",
    [PlatformAdminErrorCode.WorkspaceNotFound]: "not-found",
}

/** The one error class of the platform-admin capability. */
export class PlatformAdminError extends DomainError<PlatformAdminErrorCode> {}
