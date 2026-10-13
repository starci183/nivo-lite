import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the text-to-speech integration. */
export enum TtsErrorCode {
    /** No provider is configured: the video has captions only. */
    Disabled = "TTS_DISABLED",
    /** The provider failed in a way that may succeed on another try (throttling, a dropped socket, no audio). */
    Retryable = "TTS_RETRYABLE",
    /** The caller aborted the synthesis. */
    Aborted = "TTS_ABORTED",
}

/** How each text-to-speech code travels. */
export const TTS_ERROR_KINDS: Record<TtsErrorCode, ErrorKind> = {
    [TtsErrorCode.Disabled]: "unavailable",
    [TtsErrorCode.Retryable]: "unavailable",
    [TtsErrorCode.Aborted]: "internal",
}

/** The one error class of the text-to-speech integration. */
export class TtsError extends DomainError<TtsErrorCode> {}
