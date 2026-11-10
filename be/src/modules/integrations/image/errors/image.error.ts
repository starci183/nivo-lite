import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the image integration. */
export enum ImageErrorCode {
    /** The picture could not be read or drawn: its bytes are no image, or the drawing is not valid. */
    Failed = "IMAGE_FAILED",
}

/** How each image code travels. */
export const IMAGE_ERROR_KINDS: Record<ImageErrorCode, ErrorKind> = {
    [ImageErrorCode.Failed]: "internal",
}

/** The one error class of the image integration. */
export class ImageError extends DomainError<ImageErrorCode> {}
