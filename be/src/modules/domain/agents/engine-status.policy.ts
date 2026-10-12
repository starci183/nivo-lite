import type { OptionalSettings, Processor } from "./agents.contracts"

/** How long a customer waits for OpenClaw before the app answers directly, seconds. */
export const DEFAULT_REPLY_TIMEOUT_SEC = 25
const REPLY_TIMEOUT_MIN_SEC = 5
const REPLY_TIMEOUT_MAX_SEC = 120

/** What the settings of an installation say about who answers: OpenClaw unless an operator switched it to the direct model. */
export const processorFromSettings = (settings: OptionalSettings): Processor =>
    settings?.processor === "nivo" ? "nivo" : "openclaw"

/** The installation setting "longest wait", seconds: a number from 5 to 120, else the default. */
export const replyTimeoutSec = (settings: OptionalSettings): number => {
    const seconds = Number(settings?.openclawTimeoutSec)
    return Number.isFinite(seconds) && seconds >= REPLY_TIMEOUT_MIN_SEC && seconds <= REPLY_TIMEOUT_MAX_SEC
        ? Math.round(seconds)
        : DEFAULT_REPLY_TIMEOUT_SEC
}

/** True when the instant is younger than the window. */
export const isFresh = (at: string | null, nowMs: number, windowMs: number): boolean =>
    at !== null && nowMs - Date.parse(at) < windowMs
