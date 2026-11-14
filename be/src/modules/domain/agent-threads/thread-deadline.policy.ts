import type { RunStop } from "./stops/run-stop.contracts"

const HOUR_MS = 60 * 60_000

/** How long a stop of kind `approval` waits for a person before its deadline answers it `timeout`: 24 hours. */
export const APPROVAL_DEADLINE_MS = 24 * HOUR_MS

/** How long a stop that waits for the founder (an AI report or an AI error) waits before its deadline: 3 days. */
export const OWNER_DEADLINE_MS = 72 * HOUR_MS

/** The longest wait a template may declare for a step (a deadline job's delay is a 32-bit count of milliseconds): 20 days. */
const TEMPLATE_WAIT_MAX_MS = 20 * 24 * HOUR_MS

/** The spellings of a template wait ("30m", "2h", "3d"), each with the milliseconds one of its unit lasts. */
const WAIT_UNITS: Readonly<Record<string, number>> = { m: 60_000, h: HOUR_MS, d: 24 * HOUR_MS }

/** The windows of the deadlines, as the app sets them (absent takes the defaults above). */
export interface DeadlineWindows {
    /** The window of an approval stop, milliseconds. */
    readonly approvalMs?: number | undefined
    /** The window of a stop that waits for the founder, milliseconds. */
    readonly ownerMs?: number | undefined
}

/** A template wait (`wait.timeout` of a step: "30m", "2h", "3d") in milliseconds; null when it is none, zero or longer than 20 days. */
export const templateWaitMsOf = (text: string | undefined): number | null => {
    const found = text === undefined ? null : /^(\d{1,4})([mhd])$/u.exec(text.trim())
    const amount = found?.[1]
    const unit = found?.[2]
    if (amount === undefined || unit === undefined) return null
    const ms = Number(amount) * (WAIT_UNITS[unit] ?? 0)
    return ms > 0 && ms <= TEMPLATE_WAIT_MAX_MS ? ms : null
}

/**
 * How long a stop waits before a NIVO deadline answers it `timeout`, or null when no deadline applies. A stop of kind `engine` has none
 * (only a person can decide it). A stop that a deadline already answered has none either: a deadline fires ONCE per stop, so a step that
 * stops again after its timeout waits for a person, never on a ladder of timeouts. A step whose template declares a wait (`wait.timeout`)
 * waits that long; otherwise an approval waits 24 hours and a stop for the founder 3 days. A stop a person took over (its last decision
 * `take_over`) has none (ruling R52): the person holds the route, so a timeout would run the step again under the hold and race the
 * hand-back's close; once a hand-back, retry or words moves it on, the normal windows apply to the stop it leaves. Mechanics only: what a
 * timeout means is the step's to decide when it runs again.
 */
export const deadlineWindowOf = (
    stop: Pick<RunStop, "kind" | "answers"> & Partial<Pick<RunStop, "decision">>,
    templateWait: string | undefined,
    windows: DeadlineWindows = {},
): number | null => {
    if (stop.kind === "engine") return null
    if (stop.decision?.kind === "take_over") return null
    if (stop.answers.some((answer) => answer.kind === "timeout")) return null
    const declared = templateWaitMsOf(templateWait)
    if (declared !== null) return declared
    return stop.kind === "approval"
        ? (windows.approvalMs ?? APPROVAL_DEADLINE_MS)
        : (windows.ownerMs ?? OWNER_DEADLINE_MS)
}

/** When the deadline of a stop comes: its window after the stop last stopped. */
export const deadlineAtOf = (stop: Pick<RunStop, "stoppedAt">, windowMs: number): Date =>
    new Date(new Date(stop.stoppedAt).getTime() + windowMs)
