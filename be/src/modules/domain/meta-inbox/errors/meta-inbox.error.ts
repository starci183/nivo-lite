import { DomainError, type ErrorKind } from "@modules/platform/errors"

/** Codes of the meta-inbox capability. */
export enum MetaInboxErrorCode {
    /** The delivery is not signed by the Meta app. */
    SignatureInvalid = "META_INBOX_SIGNATURE_INVALID",
    /** The delivery has no body or signature, or its body is no JSON object: it names no event to receive. */
    DeliveryInvalid = "META_INBOX_DELIVERY_INVALID",
}

/** How each meta-inbox code travels. */
export const META_INBOX_ERROR_KINDS: Record<MetaInboxErrorCode, ErrorKind> = {
    [MetaInboxErrorCode.SignatureInvalid]: "unauthenticated",
    [MetaInboxErrorCode.DeliveryInvalid]: "invalid",
}

/** The one error class of the meta-inbox capability. */
export class MetaInboxError extends DomainError<MetaInboxErrorCode> {}
