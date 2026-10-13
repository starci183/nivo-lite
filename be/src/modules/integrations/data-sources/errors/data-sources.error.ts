import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the data-sources integration: why the owner's own system could not be read, in words the owner can act on. */
export enum DataSourcesErrorCode {
    /** The host the owner typed is not a usable address. */
    HostInvalid = "DATA_SOURCES_HOST_INVALID",
    /** The host name does not resolve. */
    HostUnknown = "DATA_SOURCES_HOST_UNKNOWN",
    /** The host points into a private network. */
    HostPrivate = "DATA_SOURCES_HOST_PRIVATE",
    /** The answer or the file is larger than the limit. */
    TooLarge = "DATA_SOURCES_TOO_LARGE",
    /** The system refused or rejected the request; its plain-language reason rides in the `detail` param. */
    Rejected = "DATA_SOURCES_REJECTED",
    /** The system could not be reached or did not answer; the plain-language reason rides in the `detail` param. */
    Unavailable = "DATA_SOURCES_UNAVAILABLE",
}

/** How each data-sources code travels. */
export const DATA_SOURCES_ERROR_KINDS: Record<DataSourcesErrorCode, ErrorKind> = {
    [DataSourcesErrorCode.HostInvalid]: "invalid",
    [DataSourcesErrorCode.HostUnknown]: "invalid",
    [DataSourcesErrorCode.HostPrivate]: "invalid",
    [DataSourcesErrorCode.TooLarge]: "invalid",
    [DataSourcesErrorCode.Rejected]: "invalid",
    [DataSourcesErrorCode.Unavailable]: "unavailable",
}

/** The one error class of the data-sources integration. */
export class DataSourcesError extends DomainError<DataSourcesErrorCode> {}
