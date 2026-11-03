import type { PollFailure } from "./connection-poll.contracts"
import type { PollOutcome, PollScheduleOptions, PollScheduleRow } from "./poll-schedule.contracts"

/** The intervals and caps a scheduler runs with when the environment names none. */
export const DEFAULT_POLL_SCHEDULE: PollScheduleOptions = {
    healthyIntervalMs: 30 * 60_000,
    silentIntervalMs: 5 * 60_000,
    hotIntervalMs: 90_000,
    webhookSilentAfterMs: 6 * 3_600_000,
    hotTtlMs: 30 * 60_000,
    jitterRatio: 0.2,
    backoffBaseMs: 30_000,
    backoffCapMs: 30 * 60_000,
    breakerThreshold: 5,
    breakerCooldownMs: 10 * 60_000,
    breakerCooldownCapMs: 6 * 3_600_000,
    batchSize: 50,
    leaseMs: 10 * 60_000,
    maxInlineWaitMs: 5_000,
    backfillChunkPages: 2,
}

/** The facts of a connection the interval is chosen from. */
export type IntervalFacts = Pick<PollScheduleRow, "failures" | "hotUntil" | "lastWebhookAt">

/** What a settled poll writes back to the schedule row of its connection. */
export interface PollPlan {
    /** When the connection is read next, in epoch milliseconds. */
    readonly nextPollAt: number
    /** The interval the plan was made with. */
    readonly intervalMs: number
    /** Consecutive failed polls after this one. */
    readonly failures: number
    /** Where the breaker stands after this poll. */
    readonly breakerState: PollScheduleRow["breakerState"]
    /** When the breaker opened, in epoch milliseconds; null while it is closed. */
    readonly breakerOpenedAt: number | null
    /** The provider refused the credential. */
    readonly needsReauth: boolean
    /** True when this poll is the one that made the connection need the owner: one owner work item is raised for it. */
    readonly raiseOwnerNotice: boolean
    /** True when the poll ended well, so the success time is stamped. */
    readonly succeeded: boolean
    /** The end of the next older page of an unfinished backfill; null when there is none. */
    readonly backfillTo: number | null
    /** The newest instant an unfinished backfill read; null when there is none. */
    readonly backfillNewest: number | null
}

/** `ms` moved by a random share of at most `ratio` either way; `unit` is a random number in [0, 1). */
export const jittered = (ms: number, ratio: number, unit: number): number =>
    Math.max(1, Math.round(ms * (1 + (unit * 2 - 1) * ratio)))

/** The wait after the n-th consecutive failure: the base, doubled for each further failure, never past the cap. */
export const backoffMs = (failures: number, baseMs: number, capMs: number): number =>
    Math.min(capMs, baseMs * 2 ** Math.max(0, failures - 1))

/**
 * How often a connection is read: hot while it has demand; short while its webhook is silent (it delivered nothing for the threshold, or never) or
 * the last polls failed; long while the webhook delivers.
 */
export const intervalFor = (facts: IntervalFacts, now: number, options: PollScheduleOptions): number => {
    if (facts.hotUntil !== null && facts.hotUntil.getTime() > now) return options.hotIntervalMs
    if (facts.failures > 0 || facts.lastWebhookAt === null) return options.silentIntervalMs
    return now - facts.lastWebhookAt.getTime() > options.webhookSilentAfterMs
        ? options.silentIntervalMs
        : options.healthyIntervalMs
}

/** How long a breaker that has failed `failures` times in a row stays open: the cool-down, doubled for each failure past the threshold, never past its cap. */
export const cooldownMs = (failures: number, options: PollScheduleOptions): number =>
    Math.min(
        options.breakerCooldownCapMs,
        options.breakerCooldownMs * 2 ** Math.max(0, failures - options.breakerThreshold),
    )

/** A row claimed for a poll: an open breaker whose cool-down is over lets this one poll through as its probe. */
export const probeOf = (row: PollScheduleRow): PollScheduleRow =>
    row.breakerState === "open" ? { ...row, breakerState: "half_open" } : row

const closedPlan = (row: PollScheduleRow, now: number, options: PollScheduleOptions, unit: number): PollPlan => {
    const intervalMs = intervalFor({ ...row, failures: 0 }, now, options)
    return {
        nextPollAt: now + jittered(intervalMs, options.jitterRatio, unit),
        intervalMs,
        failures: 0,
        breakerState: "closed",
        breakerOpenedAt: null,
        needsReauth: false,
        raiseOwnerNotice: false,
        succeeded: true,
        backfillTo: null,
        backfillNewest: null,
    }
}

/** The plan after a poll that read: the next poll at the adaptive interval; an unfinished backfill goes on at the hot interval. */
export const planAfterRead = (
    row: PollScheduleRow,
    outcome: Extract<PollOutcome, { kind: "done" | "partial" | "skipped" }>,
    now: number,
    options: PollScheduleOptions,
    unit: number,
): PollPlan => {
    const closed = { ...closedPlan(row, now, options, unit), succeeded: outcome.kind !== "skipped" }
    if (outcome.kind !== "partial") return closed
    return {
        ...closed,
        intervalMs: options.hotIntervalMs,
        nextPollAt: now + jittered(options.hotIntervalMs, options.jitterRatio, unit),
        backfillTo: outcome.resumeTo.getTime(),
        backfillNewest: outcome.newest?.getTime() ?? null,
    }
}

const keptBackfill = (row: PollScheduleRow): Pick<PollPlan, "backfillTo" | "backfillNewest"> => ({
    backfillTo: row.backfillTo?.getTime() ?? null,
    backfillNewest: row.backfillNewest?.getTime() ?? null,
})

const openPlan = (
    row: PollScheduleRow,
    waitMs: number,
    now: number,
    options: PollScheduleOptions,
    unit: number,
): PollPlan => ({
    nextPollAt: now + jittered(waitMs, options.jitterRatio, unit),
    intervalMs: waitMs,
    failures: row.failures + 1,
    breakerState: "open",
    breakerOpenedAt: now,
    needsReauth: false,
    raiseOwnerNotice: false,
    succeeded: false,
    ...keptBackfill(row),
})

const transientPlan = (row: PollScheduleRow, now: number, options: PollScheduleOptions, unit: number): PollPlan => {
    const failures = row.failures + 1
    if (row.breakerState === "half_open" || failures >= options.breakerThreshold) {
        return openPlan(row, cooldownMs(failures, options), now, options, unit)
    }
    const waitMs = backoffMs(failures, options.backoffBaseMs, options.backoffCapMs)
    return {
        nextPollAt: now + jittered(waitMs, options.jitterRatio, unit),
        intervalMs: waitMs,
        failures,
        breakerState: row.breakerState,
        breakerOpenedAt: row.breakerOpenedAt?.getTime() ?? null,
        needsReauth: false,
        raiseOwnerNotice: false,
        succeeded: false,
        ...keptBackfill(row),
    }
}

const rateLimitedPlan = (
    row: PollScheduleRow,
    retryAfterMs: number,
    now: number,
    options: PollScheduleOptions,
    unit: number,
): PollPlan => {
    const failures = row.failures + 1
    const backoff = backoffMs(failures, options.backoffBaseMs, options.backoffCapMs)
    const waitMs = Math.max(retryAfterMs, jittered(backoff, options.jitterRatio, unit))
    return {
        nextPollAt: now + waitMs,
        intervalMs: waitMs,
        failures,
        breakerState: row.breakerState === "half_open" ? "closed" : row.breakerState,
        breakerOpenedAt: row.breakerState === "half_open" ? null : (row.breakerOpenedAt?.getTime() ?? null),
        needsReauth: false,
        raiseOwnerNotice: false,
        succeeded: false,
        ...keptBackfill(row),
    }
}

/**
 * The plan after a failed poll, by how the provider adapter classified it. A 429 waits at least its Retry-After and then backs off exponentially
 * without counting against the breaker; a transient failure backs off and opens the breaker at the threshold (or at once when it was the probe of
 * a half-open breaker); a refused credential opens the breaker, parks the connection for the owner and asks for one owner work item; a fatal
 * failure opens the breaker for the longest cool-down.
 */
export const planAfterFailure = (
    row: PollScheduleRow,
    failure: PollFailure,
    now: number,
    options: PollScheduleOptions,
    unit: number,
): PollPlan => {
    switch (failure.kind) {
        case "rate_limited":
            return rateLimitedPlan(row, failure.retryAfterSeconds * 1000, now, options, unit)
        case "transient":
            return transientPlan(row, now, options, unit)
        case "auth_failed":
            return {
                ...openPlan(row, options.breakerCooldownCapMs, now, options, unit),
                needsReauth: true,
                raiseOwnerNotice: !row.needsReauth,
            }
        case "fatal":
            return openPlan(row, options.breakerCooldownCapMs, now, options, unit)
    }
}

/** The claimed rows interleaved by workspace, one from each workspace in turn, so a workspace with many connections never starves the others. */
export const interleavedByWorkspace = <Row extends { readonly workspaceId: string }>(
    rows: ReadonlyArray<Row>,
): Array<Row> => {
    const queues = new Map<string, Array<Row>>()
    rows.forEach((row) => {
        queues.set(row.workspaceId, [...(queues.get(row.workspaceId) ?? []), row])
    })
    const turns = Math.max(0, ...[...queues.values()].map((queue) => queue.length))
    return Array.from({ length: turns }, (_turn, index) => [...queues.values()].flatMap((queue) => queue[index] ?? [])).flat()
}
