import { DomainError } from "@modules/platform/errors"
import type { ErrorKind } from "@modules/platform/errors"

/** Codes of the realtime capability. */
export enum RealtimeErrorCode {
    /** A shared hub was registered with no connection to hold its tables. */
    ConnectionMissing = "REALTIME_CONNECTION_MISSING",
    /** The replay of a reconnecting subscription could not be loaded from the shared store. */
    ReplayFailed = "REALTIME_REPLAY_FAILED",
    /** A LISTEN connection never heard its own probe: it is behind a transaction pooler or another proxy that does not deliver notifications. */
    ListenSilent = "REALTIME_LISTEN_SILENT",
    /** A LISTEN connection was lost while it was still opening. */
    ListenDropped = "REALTIME_LISTEN_DROPPED",
}

/** How each realtime code travels. */
export const REALTIME_ERROR_KINDS: Record<RealtimeErrorCode, ErrorKind> = {
    [RealtimeErrorCode.ConnectionMissing]: "internal",
    [RealtimeErrorCode.ReplayFailed]: "internal",
    [RealtimeErrorCode.ListenSilent]: "internal",
    [RealtimeErrorCode.ListenDropped]: "internal",
}

/** The one error class of the realtime capability. */
export class RealtimeError extends DomainError<RealtimeErrorCode> {}
