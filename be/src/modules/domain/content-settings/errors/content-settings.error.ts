import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Configuration refusals. */
export enum ContentSettingsErrorCode {
    /** Names, ids or channels occur more than once. */
    Duplicate = "CONTENT_SETTINGS_DUPLICATE",
    /** An edited pillar does not belong to the selected workspace. */
    PillarNotFound = "CONTENT_SETTINGS_PILLAR_NOT_FOUND",
}

/** How configuration refusals travel. */
export const CONTENT_SETTINGS_ERROR_KINDS: Record<ContentSettingsErrorCode, ErrorKind> = {
    [ContentSettingsErrorCode.Duplicate]: "invalid",
    [ContentSettingsErrorCode.PillarNotFound]: "not-found",
}

/** The error family of content configuration. */
export class ContentSettingsError extends DomainError<ContentSettingsErrorCode> {}
