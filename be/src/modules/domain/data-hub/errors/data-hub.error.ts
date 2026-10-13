import { DATA_SOURCES_ERROR_KINDS } from "@modules/integrations/data-sources"
import type { DataSourcesErrorCode } from "@modules/integrations/data-sources"
import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the data-hub capability. */
export enum DataHubErrorCode {
    /** The workspace has no such data connection. */
    NotFound = "DATA_HUB_NOT_FOUND",
    /** What the owner typed does not fit; the plain-language reason rides in the `detail` param. */
    Invalid = "DATA_HUB_INVALID",
    /** The sync schedule is outside five minutes to seven days. */
    ScheduleInvalid = "DATA_HUB_SCHEDULE_INVALID",
    /** A sync failed with no reason of its own to show. */
    SyncFailed = "DATA_HUB_SYNC_FAILED",
}

/** How each data-hub code travels, with the data-sources codes it surfaces. */
export const DATA_HUB_ERROR_KINDS: Record<DataHubErrorCode | DataSourcesErrorCode, ErrorKind> = {
    ...DATA_SOURCES_ERROR_KINDS,
    [DataHubErrorCode.NotFound]: "not-found",
    [DataHubErrorCode.Invalid]: "invalid",
    [DataHubErrorCode.ScheduleInvalid]: "invalid",
    [DataHubErrorCode.SyncFailed]: "unavailable",
}

/** The one error class of the data-hub capability. */
export class DataHubError extends DomainError<DataHubErrorCode> {}
