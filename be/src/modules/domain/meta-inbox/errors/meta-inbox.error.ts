import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the meta-inbox capability. */
export enum MetaInboxErrorCode {
    /** The delivery is not signed by the Meta app. */
    SignatureInvalid = "META_INBOX_SIGNATURE_INVALID",
}

/** How each meta-inbox code travels. */
export const META_INBOX_ERROR_KINDS: Record<MetaInboxErrorCode, ErrorKind> = {
    [MetaInboxErrorCode.SignatureInvalid]: "unauthenticated",
}

/** The one error class of the meta-inbox capability. */
export class MetaInboxError extends DomainError<MetaInboxErrorCode> {}
