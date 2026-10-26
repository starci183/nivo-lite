import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the avatars capability. */
export enum AvatarsErrorCode {
    /** The picture is not a PNG, JPEG or WebP image of at most 2 MB. */
    FileInvalid = "AVATARS_FILE_INVALID",
    /** The path is not one the back end issued for this kind of picture. */
    PathInvalid = "AVATARS_PATH_INVALID",
    /** The storage would serve the picture over plain HTTP, which no avatar may use. */
    AddressInsecure = "AVATARS_ADDRESS_INSECURE",
    /** The storage or the account could not be reached. */
    Unavailable = "AVATARS_UNAVAILABLE",
}

/** How each avatars failure travels to the browser. */
export const AVATARS_ERROR_KINDS: Record<AvatarsErrorCode, ErrorKind> = {
    [AvatarsErrorCode.FileInvalid]: "invalid",
    [AvatarsErrorCode.PathInvalid]: "invalid",
    [AvatarsErrorCode.AddressInsecure]: "unavailable",
    [AvatarsErrorCode.Unavailable]: "unavailable",
}

/** The one typed error of the avatars capability. */
export class AvatarsError extends DomainError<AvatarsErrorCode> {}
