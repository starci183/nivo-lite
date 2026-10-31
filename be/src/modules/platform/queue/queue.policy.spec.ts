import { Test } from "@nestjs/testing"
import { DomainError } from "@modules/platform/errors"
import { QueueError, QueueErrorCode } from "./errors/queue.error"
import type { QueueHandler } from "./queue.contracts"
import {
    ATTEMPTS,
    BACKOFF_MS,
    KEEP_COMPLETED_SECONDS,
    KEEP_FAILED_SECONDS,
    REDIS_DEADLINE_MS,
    backoffMsOf,
    backoffSecondsOf,
    deferMsOf,
    deliveryOf,
    isExhausted,
    isUnrecoverable,
    isQueueMemoryBounded,
    jobOf,
    reasonOf,
    retryAfterSecondsOf,
    routeOf,
    secondsOf,
    slotOf,
    workspaceOf,
} from "./queue.policy"
import type { BullmqJob } from "./queue-transport.port"

const WORKSPACE = "3f0c7a52-8d1e-4b6a-9c2d-5e7f10a4b8c6"
class CapabilityError extends DomainError<"CAPABILITY_FAILED"> {}

const signal = new AbortController().signal
const queueError = (code: QueueErrorCode, params: Record<string, string | number> = {}): QueueError =>
    new QueueError({ code, params })
const handlerOf = (job?: string): QueueHandler => ({ queue: "knowledge", job, handle: () => Promise.resolve() })
const brokerJob = (job: Partial<BullmqJob>): BullmqJob => ({
    id: "row-1",
    name: "knowledge.index",
    data: {},
    attemptsMade: 1,
    moveToDelayed: () => Promise.resolve(),
    getState: () => Promise.resolve("wait"),
    remove: () => Promise.resolve(),
    ...job,
})

/** Exposes the pure policy functions as one real provider in the Nest test graph. */
class QueuePolicySubject {
    readonly ATTEMPTS = ATTEMPTS
    readonly BACKOFF_MS = BACKOFF_MS
    readonly KEEP_COMPLETED_SECONDS = KEEP_COMPLETED_SECONDS
    readonly KEEP_FAILED_SECONDS = KEEP_FAILED_SECONDS
    readonly REDIS_DEADLINE_MS = REDIS_DEADLINE_MS
    readonly isQueueMemoryBounded = isQueueMemoryBounded
    readonly backoffMsOf = backoffMsOf
    readonly backoffSecondsOf = backoffSecondsOf
    readonly deferMsOf = deferMsOf
    readonly deliveryOf = deliveryOf
    readonly isExhausted = isExhausted
    readonly isUnrecoverable = isUnrecoverable
    readonly jobOf = jobOf
    readonly reasonOf = reasonOf
    readonly retryAfterSecondsOf = retryAfterSecondsOf
    readonly routeOf = routeOf
    readonly secondsOf = secondsOf
    readonly slotOf = slotOf
    readonly workspaceOf = workspaceOf
}

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [QueuePolicySubject] }).compile()
    return moduleRef.get(QueuePolicySubject)
}

it("declares the retry budget of every job", async () => {
    const subject = await build()
    expect({ attempts: subject.ATTEMPTS, backoffMs: subject.BACKOFF_MS }).toEqual({ attempts: 4, backoffMs: 5000 })
    expect([subject.KEEP_COMPLETED_SECONDS, subject.KEEP_FAILED_SECONDS, subject.REDIS_DEADLINE_MS]).toEqual([
        3600, 604800, 5000,
    ])
})

it("requires bounded Redis memory and noeviction before admitting queue work", async () => {
    const subject = await build()
    expect([
        subject.isQueueMemoryBounded("maxmemory:268435456\r\nmaxmemory_policy:noeviction\r\n"),
        subject.isQueueMemoryBounded("maxmemory:1\nmaxmemory_policy:noeviction\n"),
        subject.isQueueMemoryBounded("maxmemory:0\r\nmaxmemory_policy:noeviction\r\n"),
        subject.isQueueMemoryBounded("maxmemory:268435456\r\nmaxmemory_policy:allkeys-lru\r\n"),
        subject.isQueueMemoryBounded("maxmemory_policy:noeviction\r\n"),
    ]).toEqual([true, true, false, false, false])
})

it("rounds milliseconds up to whole seconds", async () => {
    const subject = await build()
    expect([subject.secondsOf(0), subject.secondsOf(1), subject.secondsOf(1000), subject.secondsOf(30_001)]).toEqual([
        0, 1, 1, 31,
    ])
})

it("doubles the backoff with every start of the job: 5 s, 5 s, 10 s, 20 s", async () => {
    const subject = await build()
    expect([0, 1, 2, 3].map(subject.backoffSecondsOf)).toEqual([5, 5, 10, 20])
})

it("keeps the broker retry pause in milliseconds and honors the retry hint of the failing error", async () => {
    const subject = await build()
    expect([subject.backoffMsOf(1), subject.backoffMsOf(2), subject.backoffMsOf(3)]).toEqual([5000, 10000, 20000])
    expect(subject.backoffMsOf(2, queueError(QueueErrorCode.RetryAfter, { seconds: 7.2 }))).toBe(8000)
    expect(subject.backoffMsOf(2, new Error("down"))).toBe(10000)
})

it("defers a job refused by the workspace limit a few seconds, spread by its id, never under three", async () => {
    const subject = await build()
    const pauses = Array.from({ length: 50 }, (_, index) => subject.deferMsOf(`row-${index}`))
    expect(Math.min(...pauses)).toBeGreaterThanOrEqual(3000)
    expect(Math.max(...pauses)).toBeLessThan(5000)
    expect(subject.deferMsOf("row-1")).toBe(subject.deferMsOf("row-1"))
    expect(new Set(pauses).size).toBeGreaterThan(1)
})

it("exhausts a job on its last attempt", async () => {
    const subject = await build()
    expect([
        subject.isExhausted(subject.ATTEMPTS - 1),
        subject.isExhausted(subject.ATTEMPTS),
        subject.isExhausted(subject.ATTEMPTS + 1),
    ]).toEqual([false, true, true])
})

it("exhausts a job of another budget on its own last attempt", async () => {
    const subject = await build()
    expect([subject.isExhausted(2, 3), subject.isExhausted(3, 3)]).toEqual([false, true])
})

it("reads the slot of a job of a scheduler from its broker id, and nothing from any other id", async () => {
    const subject = await build()
    expect(subject.slotOf("repeat:agent-trigger:3f1c:1794283200000")).toBe("1794283200000")
    expect(subject.slotOf("row-1")).toBeNull()
    expect(subject.slotOf("repeat:agent-trigger:3f1c:soon")).toBeNull()
})

describe("failures", () => {
    it("ends a domain failure only when the owning capability explicitly marks it unrecoverable", async () => {
        const subject = await build()
        expect([
            subject.isUnrecoverable(new CapabilityError({ code: "CAPABILITY_FAILED", params: { unrecoverable: 1 } })),
            subject.isUnrecoverable(new CapabilityError({ code: "CAPABILITY_FAILED", params: { unrecoverable: 0 } })),
            subject.isUnrecoverable(new CapabilityError({ code: "CAPABILITY_FAILED", params: { unrecoverable: "1" } })),
            subject.isUnrecoverable(new CapabilityError({ code: "CAPABILITY_FAILED" })),
        ]).toEqual([true, false, false, false])
    })

    it("honors finite domain retry hints within one to 3600 seconds and rounds the pause up", async () => {
        const subject = await build()
        expect(
            [1, 7.2, "30", 3599.2, 3600].map((retryAfterSeconds) =>
                subject.retryAfterSecondsOf(
                    new CapabilityError({ code: "CAPABILITY_FAILED", params: { retryAfterSeconds } }),
                ),
            ),
        ).toEqual([1, 8, 30, 3600, 3600])
    })

    it("ignores missing, non-finite and out-of-range domain retry hints", async () => {
        const subject = await build()
        expect([
            subject.retryAfterSecondsOf(new CapabilityError({ code: "CAPABILITY_FAILED" })),
            ...["soon", Infinity, 0, 0.9, 3600.1].map((retryAfterSeconds) =>
                subject.retryAfterSecondsOf(
                    new CapabilityError({ code: "CAPABILITY_FAILED", params: { retryAfterSeconds } }),
                ),
            ),
        ]).toEqual([undefined, undefined, undefined, undefined, undefined, undefined])
    })

    it("ends a job at once on an unrecoverable error or a job nobody handles, and on nothing else", async () => {
        const subject = await build()
        expect([
            subject.isUnrecoverable(queueError(QueueErrorCode.Unrecoverable)),
            subject.isUnrecoverable(queueError(QueueErrorCode.HandlerMissing)),
            subject.isUnrecoverable(queueError(QueueErrorCode.RetryAfter)),
            subject.isUnrecoverable(new Error("down")),
        ]).toEqual([true, true, false, false])
    })

    it("reads the pause a retry-after error asks for, rounded up, and no other failure sets one", async () => {
        const subject = await build()
        expect([
            subject.retryAfterSecondsOf(queueError(QueueErrorCode.RetryAfter, { seconds: 7.2 })),
            subject.retryAfterSecondsOf(queueError(QueueErrorCode.RetryAfter, { seconds: -3 })),
            subject.retryAfterSecondsOf(queueError(QueueErrorCode.RetryAfter, { seconds: "soon" })),
            subject.retryAfterSecondsOf(queueError(QueueErrorCode.Unrecoverable, { seconds: 7 })),
            subject.retryAfterSecondsOf(new Error("down")),
        ]).toEqual([8, 0, undefined, undefined, undefined])
    })

    it("explains a failure by the reason of a queue error, else by its code, else by the message of the failure", async () => {
        const subject = await build()
        expect([
            subject.reasonOf(queueError(QueueErrorCode.Unrecoverable, { reason: "blocked_credits" })),
            subject.reasonOf(queueError(QueueErrorCode.HandlerMissing)),
            subject.reasonOf(new Error("provider down")),
            subject.reasonOf("plain text"),
        ]).toEqual(["blocked_credits", "QUEUE_HANDLER_MISSING", "provider down", "plain text"])
    })
})

describe("queue policy workspaceOf", () => {
    it("takes the workspace id of a payload that carries a uuid", async () => {
        const subject = await build()
        expect(subject.workspaceOf({ workspaceId: WORKSPACE })).toBe(WORKSPACE)
    })

    it("answers null for a payload with no workspace, a non-text one or a text that is not a uuid", async () => {
        const subject = await build()
        expect([
            subject.workspaceOf({}),
            subject.workspaceOf({ workspaceId: 7 }),
            subject.workspaceOf({ workspaceId: "w-1" }),
        ]).toEqual([null, null, null])
    })
})

describe("queue policy jobOf", () => {
    it("names the job after the queue and leaves the dedupe key to the database when the producer says nothing", async () => {
        const subject = await build()
        expect(subject.jobOf("knowledge", { workspaceId: WORKSPACE }, {})).toEqual({
            queue: "knowledge",
            job: "knowledge",
            dedupeKey: null,
            workspaceId: WORKSPACE,
            payload: { workspaceId: WORKSPACE },
        })
    })

    it("keeps the job name and the dedupe key the producer chose", async () => {
        const subject = await build()
        expect(
            subject.jobOf(
                "knowledge",
                { sourceId: "s-1" },
                { job: "knowledge.index", dedupeKey: "knowledge.index:s-1" },
            ),
        ).toEqual({
            queue: "knowledge",
            job: "knowledge.index",
            dedupeKey: "knowledge.index:s-1",
            workspaceId: null,
            payload: { sourceId: "s-1" },
        })
    })
})

describe("queue policy deliveryOf", () => {
    it("delivers a broker job under its outbox row id, its job name and the attempt the database counted", async () => {
        const subject = await build()
        expect(
            subject.deliveryOf(
                "knowledge",
                brokerJob({ name: "knowledge.index", data: { sourceId: "s-1" } }),
                2,
                signal,
            ),
        ).toEqual({
            id: "row-1",
            queue: "knowledge",
            job: "knowledge.index",
            payload: { sourceId: "s-1" },
            attempt: 2,
            signal,
        })
    })

    it("delivers a job without a name or payload in the job of its queue with an empty payload", async () => {
        const subject = await build()
        expect(subject.deliveryOf("sweep", brokerJob({ name: "", data: {} }), 1, signal)).toEqual({
            id: "row-1",
            queue: "sweep",
            job: "sweep",
            payload: {},
            attempt: 1,
            signal,
        })
    })

    it("uses a stable diagnostic identity when a broker source has no id", async () => {
        const subject = await build()
        expect(subject.deliveryOf("sweep", brokerJob({ id: undefined }), 1, signal).id).toBe("sweep:unknown")
    })
})

describe("queue policy routeOf", () => {
    const delivery = deliveryOf("knowledge", brokerJob({ name: "knowledge.facts" }), 1, signal)

    it("prefers the handler of the job to the handler of the whole queue", async () => {
        const subject = await build()
        const whole = handlerOf()
        const facts = handlerOf("knowledge.facts")

        expect(subject.routeOf([whole, handlerOf("knowledge.index"), facts], delivery)).toBe(facts)
    })

    it("falls back to the handler of the whole queue, and answers none when there is no such handler", async () => {
        const subject = await build()
        const whole = handlerOf()

        expect(subject.routeOf([handlerOf("knowledge.index"), whole], delivery)).toBe(whole)
        expect(subject.routeOf([handlerOf("knowledge.index")], delivery)).toBeUndefined()
    })
})
