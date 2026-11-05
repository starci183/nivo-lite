import { Test } from "@nestjs/testing"
import type { PollFailure } from "./connection-poll.contracts"
import type { PollScheduleOptions } from "./connection-poll.options"
import type { PollScheduleRow } from "./poll-schedule.contracts"
import {
    DEFAULT_POLL_SCHEDULE,
    authReasonOf,
    backoffMs,
    cooldownMs,
    interleavedByWorkspace,
    intervalFor,
    jittered,
    planAfterFailure,
    planAfterRead,
    probeOf,
} from "./poll-schedule.policy"

const SUBJECT = Symbol("poll-schedule.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    authReasonOf,
                    backoffMs,
                    cooldownMs,
                    intervalFor,
                    interleavedByWorkspace,
                    jittered,
                    planAfterFailure,
                    planAfterRead,
                    probeOf,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./poll-schedule.policy")>(SUBJECT)
}

const MIN = 60_000
const NOW = Date.parse("2026-11-04T10:00:00.000Z")
const options: PollScheduleOptions = { ...DEFAULT_POLL_SCHEDULE, jitterRatio: 0.2 }
const MID = 0.5

const rowOf = (over: Partial<PollScheduleRow> = {}): PollScheduleRow => ({
    connectionId: "c-1",
    workspaceId: "ws-1",
    provider: "sepay",
    intervalMs: 30 * MIN,
    failures: 0,
    breakerState: "closed",
    breakerOpenedAt: null,
    needsReauth: false,
    hotUntil: null,
    lastSuccessAt: null,
    lastWebhookAt: new Date(NOW - MIN),
    unavailableReason: null,
    backfillTo: null,
    backfillNewest: null,
    ...over,
})

describe("jittered", () => {
    it("keeps the interval at the middle of the random range", async () => {
        const subject = await build()
        expect(subject.jittered(10 * MIN, 0.2, MID)).toBe(10 * MIN)
    })

    it("stays within the ratio at both ends of the random range", async () => {
        const subject = await build()
        expect(subject.jittered(10 * MIN, 0.2, 0)).toBe(8 * MIN)
        expect(subject.jittered(10 * MIN, 0.2, 0.999999)).toBeLessThanOrEqual(12 * MIN)
        expect(subject.jittered(10 * MIN, 0.2, 0.999999)).toBeGreaterThan(11.9 * MIN)
    })

    it("never answers less than a millisecond", async () => {
        const subject = await build()
        expect(subject.jittered(0, 0.2, 0)).toBe(1)
    })
})

describe("backoffMs", () => {
    it("starts at the base, doubles for each further failure and stops at the cap", async () => {
        const subject = await build()
        expect(subject.backoffMs(1, 30_000, 10 * MIN)).toBe(30_000)
        expect(subject.backoffMs(2, 30_000, 10 * MIN)).toBe(60_000)
        expect(subject.backoffMs(4, 30_000, 10 * MIN)).toBe(240_000)
        expect(subject.backoffMs(20, 30_000, 10 * MIN)).toBe(10 * MIN)
    })

    it("treats no failure like the first", async () => {
        const subject = await build()
        expect(subject.backoffMs(0, 30_000, 10 * MIN)).toBe(30_000)
    })
})

describe("intervalFor", () => {
    it("is long while the webhook delivers", async () => {
        const subject = await build()
        expect(subject.intervalFor(rowOf(), NOW, options)).toBe(30 * MIN)
    })

    it("is short once the webhook has been silent past the threshold", async () => {
        const subject = await build()
        const silent = rowOf({ lastWebhookAt: new Date(NOW - options.webhookSilentAfterMs - 1) })

        expect(subject.intervalFor(silent, NOW, options)).toBe(5 * MIN)
    })

    it("is still long exactly at the threshold", async () => {
        const subject = await build()
        const edge = rowOf({ lastWebhookAt: new Date(NOW - options.webhookSilentAfterMs) })

        expect(subject.intervalFor(edge, NOW, options)).toBe(30 * MIN)
    })

    it("is short while no webhook ever delivered", async () => {
        const subject = await build()
        expect(subject.intervalFor(rowOf({ lastWebhookAt: null }), NOW, options)).toBe(5 * MIN)
    })

    it("is short after a recent failure", async () => {
        const subject = await build()
        expect(subject.intervalFor(rowOf({ failures: 1 }), NOW, options)).toBe(5 * MIN)
    })

    it("is the shortest while hot, whatever the webhook did", async () => {
        const subject = await build()
        const hot = rowOf({ hotUntil: new Date(NOW + MIN), lastWebhookAt: null, failures: 2 })

        expect(subject.intervalFor(hot, NOW, options)).toBe(90_000)
    })

    it("falls back to the other rules once the hot time is over", async () => {
        const subject = await build()
        expect(subject.intervalFor(rowOf({ hotUntil: new Date(NOW) }), NOW, options)).toBe(30 * MIN)
    })
})

describe("cooldownMs", () => {
    it("is the base up to the threshold, doubles for each failure past it and stops at the cap", async () => {
        const subject = await build()
        expect(subject.cooldownMs(5, options)).toBe(10 * MIN)
        expect(subject.cooldownMs(6, options)).toBe(20 * MIN)
        expect(subject.cooldownMs(40, options)).toBe(options.breakerCooldownCapMs)
    })

    it("is the base when fewer failures than the threshold counted", async () => {
        const subject = await build()
        expect(subject.cooldownMs(1, options)).toBe(10 * MIN)
    })
})

describe("probeOf", () => {
    it("lets an open breaker's due poll through as its half-open probe", async () => {
        const subject = await build()
        expect(subject.probeOf(rowOf({ breakerState: "open" })).breakerState).toBe("half_open")
    })

    it.each(["closed", "half_open"] as const)("leaves a %s breaker as it is", async (state) => {
        const subject = await build()
        const row = rowOf({ breakerState: state })

        expect(subject.probeOf(row)).toBe(row)
    })
})

describe("planAfterRead", () => {
    const done = { kind: "done", fetched: 3, recorded: 1 } as const

    it("plans the next poll at the adaptive interval with the failures and the breaker cleared", async () => {
        const subject = await build()
        const plan = subject.planAfterRead(rowOf({ failures: 3, breakerState: "half_open" }), done, NOW, options, MID)

        expect(plan).toMatchObject({
            nextPollAt: NOW + 30 * MIN,
            intervalMs: 30 * MIN,
            failures: 0,
            breakerState: "closed",
            breakerOpenedAt: null,
            needsReauth: false,
            raiseOwnerNotice: false,
            succeeded: true,
            backfillTo: null,
            backfillNewest: null,
        })
    })

    it("uses the short interval when the webhook has been silent", async () => {
        const subject = await build()
        const silent = rowOf({ lastWebhookAt: null })

        expect(subject.planAfterRead(silent, done, NOW, options, MID).nextPollAt).toBe(NOW + 5 * MIN)
    })

    it("spreads the next poll by jitter within the ratio", async () => {
        const subject = await build()
        const early = subject.planAfterRead(rowOf(), done, NOW, options, 0).nextPollAt
        const late = subject.planAfterRead(rowOf(), done, NOW, options, 0.999999).nextPollAt

        expect(early).toBe(NOW + 24 * MIN)
        expect(late).toBeLessThanOrEqual(NOW + 36 * MIN)
    })

    it("does not count a skipped connection as a success", async () => {
        const subject = await build()
        const plan = subject.planAfterRead(rowOf(), { kind: "skipped", reason: "no_token" }, NOW, options, MID)

        expect(plan.succeeded).toBe(false)
        expect(plan.failures).toBe(0)
    })

    it("goes on with an unfinished backfill at the hot interval and carries where it stopped", async () => {
        const subject = await build()
        const partial = {
            kind: "partial",
            fetched: 400,
            recorded: 400,
            resumeTo: new Date(NOW - 5 * MIN),
            newest: new Date(NOW),
        } as const

        const plan = subject.planAfterRead(rowOf(), partial, NOW, options, MID)

        expect(plan).toMatchObject({
            nextPollAt: NOW + 90_000,
            intervalMs: 90_000,
            backfillTo: NOW - 5 * MIN,
            backfillNewest: NOW,
            succeeded: true,
        })
    })

    it("carries no newest instant when the unfinished chunk read none", async () => {
        const subject = await build()
        const partial = {
            kind: "partial",
            fetched: 0,
            recorded: 0,
            resumeTo: new Date(NOW),
            newest: undefined,
        } as const

        expect(subject.planAfterRead(rowOf(), partial, NOW, options, MID).backfillNewest).toBeNull()
    })
})

describe("planAfterFailure rate limited", () => {
    const limited = (seconds: number): PollFailure => ({ kind: "rate_limited", retryAfterSeconds: seconds })

    it("waits at least the Retry-After of the provider", async () => {
        const subject = await build()
        const plan = subject.planAfterFailure(rowOf(), limited(600), NOW, options, MID)

        expect(plan.nextPollAt).toBe(NOW + 10 * MIN)
        expect(plan.failures).toBe(1)
        expect(plan.breakerState).toBe("closed")
    })

    it("backs off exponentially when the provider names no wait", async () => {
        const subject = await build()
        const first = subject.planAfterFailure(rowOf(), limited(0), NOW, options, MID)
        const third = subject.planAfterFailure(rowOf({ failures: 2 }), limited(0), NOW, options, MID)

        expect(first.nextPollAt).toBe(NOW + 30_000)
        expect(third.nextPollAt).toBe(NOW + 120_000)
        expect(third.failures).toBe(3)
    })

    it("never opens the breaker however often it repeats", async () => {
        const subject = await build()
        const plan = subject.planAfterFailure(rowOf({ failures: 50 }), limited(0), NOW, options, MID)

        expect(plan.breakerState).toBe("closed")
        expect(plan.nextPollAt).toBe(NOW + options.backoffCapMs)
    })

    it("closes a half-open breaker whose probe was only told to slow down", async () => {
        const subject = await build()
        const plan = subject.planAfterFailure(
            rowOf({ breakerState: "half_open", breakerOpenedAt: new Date(NOW) }),
            limited(0),
            NOW,
            options,
            MID,
        )

        expect(plan).toMatchObject({ breakerState: "closed", breakerOpenedAt: null })
    })

    it("keeps an open breaker's time when it is told to slow down", async () => {
        const subject = await build()
        const opened = new Date(NOW - MIN)
        const plan = subject.planAfterFailure(
            rowOf({ breakerState: "open", breakerOpenedAt: opened }),
            limited(0),
            NOW,
            options,
            MID,
        )

        expect(plan).toMatchObject({ breakerState: "open", breakerOpenedAt: opened.getTime() })
    })
})

describe("planAfterFailure transient", () => {
    const transient: PollFailure = { kind: "transient" }

    it("retries with a growing backoff while the breaker stays closed", async () => {
        const subject = await build()
        const plan = subject.planAfterFailure(rowOf({ failures: 1 }), transient, NOW, options, MID)

        expect(plan).toMatchObject({ nextPollAt: NOW + 60_000, failures: 2, breakerState: "closed", succeeded: false })
    })

    it("opens the breaker at the threshold and waits out the cool-down", async () => {
        const subject = await build()
        const plan = subject.planAfterFailure(rowOf({ failures: 4 }), transient, NOW, options, MID)

        expect(plan).toMatchObject({
            nextPollAt: NOW + 10 * MIN,
            failures: 5,
            breakerState: "open",
            breakerOpenedAt: NOW,
            needsReauth: false,
            raiseOwnerNotice: false,
        })
    })

    it("opens the breaker again at once when the half-open probe fails", async () => {
        const subject = await build()
        const plan = subject.planAfterFailure(
            rowOf({ failures: 5, breakerState: "half_open" }),
            transient,
            NOW,
            options,
            MID,
        )

        expect(plan).toMatchObject({ breakerState: "open", nextPollAt: NOW + 20 * MIN, failures: 6 })
    })

    it("keeps an unfinished backfill and an earlier opening time", async () => {
        const subject = await build()
        const row = rowOf({
            failures: 1,
            backfillTo: new Date(NOW - MIN),
            backfillNewest: new Date(NOW),
            breakerOpenedAt: new Date(NOW - 5),
        })

        const plan = subject.planAfterFailure(row, transient, NOW, options, MID)

        expect(plan).toMatchObject({ backfillTo: NOW - MIN, backfillNewest: NOW, breakerOpenedAt: NOW - 5 })
    })
})

describe("planAfterFailure auth failed and fatal", () => {
    it("opens the breaker, parks the connection and asks for one owner work item", async () => {
        const subject = await build()
        const plan = subject.planAfterFailure(rowOf(), { kind: "auth_failed" }, NOW, options, MID)

        expect(plan).toMatchObject({
            breakerState: "open",
            breakerOpenedAt: NOW,
            needsReauth: true,
            raiseOwnerNotice: true,
            failures: 1,
            succeeded: false,
        })
    })

    it("asks for no second owner work item while the connection is already parked", async () => {
        const subject = await build()
        const plan = subject.planAfterFailure(rowOf({ needsReauth: true }), { kind: "auth_failed" }, NOW, options, MID)

        expect(plan.raiseOwnerNotice).toBe(false)
        expect(plan.needsReauth).toBe(true)
    })

    it("opens the breaker for the longest cool-down on a fatal failure without the owner", async () => {
        const subject = await build()
        const plan = subject.planAfterFailure(rowOf(), { kind: "fatal" }, NOW, options, MID)

        expect(plan).toMatchObject({
            breakerState: "open",
            nextPollAt: NOW + options.breakerCooldownCapMs,
            needsReauth: false,
            raiseOwnerNotice: false,
        })
    })
})

describe("interleavedByWorkspace", () => {
    const row = (workspaceId: string, id: string) => ({ workspaceId, id })

    it("takes one connection from each workspace in turn", async () => {
        const subject = await build()
        const rows = [row("a", "a1"), row("a", "a2"), row("a", "a3"), row("b", "b1"), row("c", "c1"), row("c", "c2")]

        expect(subject.interleavedByWorkspace(rows).map((item) => item.id)).toEqual([
            "a1",
            "b1",
            "c1",
            "a2",
            "c2",
            "a3",
        ])
    })

    it("answers nothing for nothing", async () => {
        const subject = await build()
        expect(subject.interleavedByWorkspace([])).toEqual([])
    })
})

describe("authReasonOf", () => {
    it("names why a refusal happened", async () => {
        const subject = await build()
        expect(subject.authReasonOf({ kind: "auth_failed", reason: "permission" })).toBe("permission")
        expect(subject.authReasonOf({ kind: "auth_failed" })).toBeUndefined()
    })

    it("names nothing for a failure that is not a refusal", async () => {
        const subject = await build()
        expect(subject.authReasonOf({ kind: "transient" })).toBeUndefined()
    })
})

describe("planAfterFailure unavailable", () => {
    const planLacks: PollFailure = { kind: "unavailable", reason: "plan", notice: "upgrade the plan" }

    it("is no failure: the breaker stays closed, nothing counts and the connection is tried again after the recheck time", async () => {
        const subject = await build()
        const plan = subject.planAfterFailure(
            rowOf({ failures: 3, breakerState: "half_open" }),
            planLacks,
            NOW,
            options,
            MID,
        )

        expect(plan).toMatchObject({
            nextPollAt: NOW + options.unavailableRecheckMs,
            intervalMs: options.unavailableRecheckMs,
            failures: 0,
            breakerState: "closed",
            breakerOpenedAt: null,
            needsReauth: false,
            succeeded: false,
            unavailableReason: "plan",
        })
    })

    it("asks for the owner notice once, when the capability first becomes unavailable", async () => {
        const subject = await build()
        expect(subject.planAfterFailure(rowOf(), planLacks, NOW, options, MID).raiseOwnerNotice).toBe(true)
        expect(
            subject.planAfterFailure(rowOf({ unavailableReason: "plan" }), planLacks, NOW, options, MID)
                .raiseOwnerNotice,
        ).toBe(false)
    })

    it("spreads the recheck by jitter and keeps an unfinished backfill", async () => {
        const subject = await build()
        const row = rowOf({ backfillTo: new Date(NOW - MIN), backfillNewest: new Date(NOW) })

        const plan = subject.planAfterFailure(row, planLacks, NOW, options, 0)

        expect(plan.nextPollAt).toBe(NOW + options.unavailableRecheckMs * 0.8)
        expect(plan).toMatchObject({ backfillTo: NOW - MIN, backfillNewest: NOW })
    })

    it("is cleared by a poll that reads again, and kept through any other failure", async () => {
        const subject = await build()
        const flagged = rowOf({ unavailableReason: "plan" })

        expect(
            subject.planAfterRead(flagged, { kind: "done", fetched: 0, recorded: 0 }, NOW, options, MID)
                .unavailableReason,
        ).toBeNull()
        expect(subject.planAfterFailure(flagged, { kind: "transient" }, NOW, options, MID).unavailableReason).toBe(
            "plan",
        )
        expect(
            subject.planAfterFailure(flagged, { kind: "rate_limited", retryAfterSeconds: 0 }, NOW, options, MID)
                .unavailableReason,
        ).toBe("plan")
        expect(subject.planAfterFailure(flagged, { kind: "fatal" }, NOW, options, MID).unavailableReason).toBe("plan")
    })
})
