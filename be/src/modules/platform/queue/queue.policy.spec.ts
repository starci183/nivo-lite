import { Test } from "@nestjs/testing"
import { DomainError } from "@modules/platform/errors"
import { QueueError, QueueErrorCode } from "./errors/queue.error"
import type { QueueHandler } from "./queue.contracts"
import {
    ATTEMPTS,
    BACKOFF_MS,
    backoffSecondsOf,
    deliveryOf,
    isExhausted,
    isUnrecoverable,
    jobOf,
    reasonOf,
    retryAfterSecondsOf,
    routeOf,
    secondsOf,
    workspaceOf,
} from "./queue.policy"

const WORKSPACE = "3f0c7a52-8d1e-4b6a-9c2d-5e7f10a4b8c6"
class CapabilityError extends DomainError<"CAPABILITY_FAILED"> {}

const signal = new AbortController().signal
const queueError = (code: QueueErrorCode, params: Record<string, string | number> = {}): QueueError =>
    new QueueError({ code, params })
const handlerOf = (job?: string): QueueHandler => ({ queue: "knowledge", job, handle: () => Promise.resolve() })

/** Exposes the pure policy functions as one real provider in the Nest test graph. */
class QueuePolicySubject {
    readonly ATTEMPTS = ATTEMPTS
    readonly BACKOFF_MS = BACKOFF_MS
    readonly backoffSecondsOf = backoffSecondsOf
    readonly deliveryOf = deliveryOf
    readonly isExhausted = isExhausted
    readonly isUnrecoverable = isUnrecoverable
    readonly jobOf = jobOf
    readonly reasonOf = reasonOf
    readonly retryAfterSecondsOf = retryAfterSecondsOf
    readonly routeOf = routeOf
    readonly secondsOf = secondsOf
    readonly workspaceOf = workspaceOf
}

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [QueuePolicySubject] }).compile()
    return moduleRef.get(QueuePolicySubject)
}

it("declares the retry budget of every job", async () => {
    const subject = await build()
    expect({ attempts: subject.ATTEMPTS, backoffMs: subject.BACKOFF_MS }).toEqual({ attempts: 4, backoffMs: 5000 })
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

it("exhausts a job on its last attempt", async () => {
    const subject = await build()
    expect([
        subject.isExhausted(subject.ATTEMPTS - 1),
        subject.isExhausted(subject.ATTEMPTS),
        subject.isExhausted(subject.ATTEMPTS + 1),
    ]).toEqual([false, true, true])
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
    it("delivers an enqueued job under its outbox row id, its job name and the attempt the database counted", async () => {
        const subject = await build()
        expect(
            subject.deliveryOf(
                "knowledge",
                {
                    msg_id: "7",
                    attempt: 2,
                    message: {
                        name: "knowledge.index",
                        payload: { sourceId: "s-1" },
                        dedupe: "k:1",
                        outbox_id: "row-1",
                    },
                },
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

    it("delivers a scheduler tick under its queue and message id, in the job of its queue, with an empty payload when it has none", async () => {
        const subject = await build()
        expect(subject.deliveryOf("sweep", { msg_id: "42", attempt: 1, message: {} }, signal)).toEqual({
            id: "sweep:42",
            queue: "sweep",
            job: "sweep",
            payload: {},
            attempt: 1,
            signal,
        })
    })
})

describe("queue policy routeOf", () => {
    const delivery = deliveryOf("knowledge", { msg_id: "1", attempt: 1, message: { name: "knowledge.facts" } }, signal)

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
