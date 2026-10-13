import { QueueError, QueueErrorCode } from "./errors/queue.error"
import type { QueueHandler } from "./queue.contracts"
import {
    ATTEMPTS,
    BACKOFF_MS,
    backoffSecondsOf,
    cronScheduleOf,
    deliveryOf,
    isExhausted,
    isUnrecoverable,
    jobOf,
    reasonOf,
    retryAfterSecondsOf,
    routeOf,
    secondsOf,
    tickOf,
    workspaceOf,
} from "./queue.policy"

const WORKSPACE = "3f0c7a52-8d1e-4b6a-9c2d-5e7f10a4b8c6"
const signal = new AbortController().signal
const queueError = (code: QueueErrorCode, params: Record<string, string | number> = {}): QueueError =>
    new QueueError({ code, params })
const handlerOf = (job?: string): QueueHandler => ({ queue: "knowledge", job, handle: () => Promise.resolve() })

describe("queue policy", () => {
    it("declares the retry budget of every job", () => {
        expect({ attempts: ATTEMPTS, backoffMs: BACKOFF_MS }).toEqual({ attempts: 4, backoffMs: 5000 })
    })

    it("rounds milliseconds up to whole seconds", () => {
        expect([secondsOf(0), secondsOf(1), secondsOf(1000), secondsOf(30_001)]).toEqual([0, 1, 1, 31])
    })

    it("doubles the backoff with every start of the job: 5 s, 5 s, 10 s, 20 s", () => {
        expect([0, 1, 2, 3].map(backoffSecondsOf)).toEqual([5, 5, 10, 20])
    })

    it("exhausts a job on its last attempt", () => {
        expect([isExhausted(ATTEMPTS - 1), isExhausted(ATTEMPTS), isExhausted(ATTEMPTS + 1)]).toEqual([
            false,
            true,
            true,
        ])
    })

    describe("failures", () => {
        it("ends a job at once on an unrecoverable error or a job nobody handles, and on nothing else", () => {
            expect([
                isUnrecoverable(queueError(QueueErrorCode.Unrecoverable)),
                isUnrecoverable(queueError(QueueErrorCode.HandlerMissing)),
                isUnrecoverable(queueError(QueueErrorCode.RetryAfter)),
                isUnrecoverable(new Error("down")),
            ]).toEqual([true, true, false, false])
        })

        it("reads the pause a retry-after error asks for, rounded up, and no other failure sets one", () => {
            expect([
                retryAfterSecondsOf(queueError(QueueErrorCode.RetryAfter, { seconds: 7.2 })),
                retryAfterSecondsOf(queueError(QueueErrorCode.RetryAfter, { seconds: -3 })),
                retryAfterSecondsOf(queueError(QueueErrorCode.RetryAfter, { seconds: "soon" })),
                retryAfterSecondsOf(queueError(QueueErrorCode.Unrecoverable, { seconds: 7 })),
                retryAfterSecondsOf(new Error("down")),
            ]).toEqual([8, 0, undefined, undefined, undefined])
        })

        it("explains a failure by the reason of a queue error, else by its code, else by the message of the failure", () => {
            expect([
                reasonOf(queueError(QueueErrorCode.Unrecoverable, { reason: "blocked_credits" })),
                reasonOf(queueError(QueueErrorCode.HandlerMissing)),
                reasonOf(new Error("provider down")),
                reasonOf("plain text"),
            ]).toEqual(["blocked_credits", "QUEUE_HANDLER_MISSING", "provider down", "plain text"])
        })
    })

    describe("workspaceOf", () => {
        it("takes the workspace id of a payload that carries a uuid", () => {
            expect(workspaceOf({ workspaceId: WORKSPACE })).toBe(WORKSPACE)
        })

        it("answers null for a payload with no workspace, a non-text one or a text that is not a uuid", () => {
            expect([workspaceOf({}), workspaceOf({ workspaceId: 7 }), workspaceOf({ workspaceId: "w-1" })]).toEqual([
                null,
                null,
                null,
            ])
        })
    })

    describe("jobOf", () => {
        it("names the job after the queue and leaves the dedupe key to the database when the producer says nothing", () => {
            expect(jobOf("knowledge", { workspaceId: WORKSPACE }, {})).toEqual({
                queue: "knowledge",
                job: "knowledge",
                dedupeKey: null,
                workspaceId: WORKSPACE,
                payload: { workspaceId: WORKSPACE },
            })
        })

        it("keeps the job name and the dedupe key the producer chose", () => {
            expect(
                jobOf("knowledge", { sourceId: "s-1" }, { job: "knowledge.index", dedupeKey: "knowledge.index:s-1" }),
            ).toEqual({
                queue: "knowledge",
                job: "knowledge.index",
                dedupeKey: "knowledge.index:s-1",
                workspaceId: null,
                payload: { sourceId: "s-1" },
            })
        })
    })

    describe("tickOf", () => {
        it("sends the tick of a scheduler under its job, or under its queue, with its payload or an empty one", () => {
            expect([
                tickOf({ queue: "sweep", job: "sweep.expired", id: "s-1", everyMs: 1000, payload: { shard: 2 } }),
                tickOf({ queue: "sweep", id: "s-2", everyMs: 1000 }),
            ]).toEqual([
                { name: "sweep.expired", payload: { shard: 2 } },
                { name: "sweep", payload: {} },
            ])
        })
    })

    describe("deliveryOf", () => {
        it("delivers an enqueued job under its outbox row id, its job name and the attempt the database counted", () => {
            expect(
                deliveryOf(
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

        it("delivers a scheduler tick under its queue and message id, in the job of its queue, with an empty payload when it has none", () => {
            expect(deliveryOf("sweep", { msg_id: "42", attempt: 1, message: {} }, signal)).toEqual({
                id: "sweep:42",
                queue: "sweep",
                job: "sweep",
                payload: {},
                attempt: 1,
                signal,
            })
        })
    })

    describe("routeOf", () => {
        const delivery = deliveryOf(
            "knowledge",
            { msg_id: "1", attempt: 1, message: { name: "knowledge.facts" } },
            signal,
        )

        it("prefers the handler of the job to the handler of the whole queue", () => {
            const whole = handlerOf()
            const facts = handlerOf("knowledge.facts")

            expect(routeOf([whole, handlerOf("knowledge.index"), facts], delivery)).toBe(facts)
        })

        it("falls back to the handler of the whole queue, and answers none when there is no such handler", () => {
            const whole = handlerOf()

            expect(routeOf([handlerOf("knowledge.index"), whole], delivery)).toBe(whole)
            expect(routeOf([handlerOf("knowledge.index")], delivery)).toBeUndefined()
        })
    })

    it("maps an interval to the pg_cron schedule of seconds, minutes or hours", () => {
        expect([
            cronScheduleOf(200),
            cronScheduleOf(30_000),
            cronScheduleOf(60_000),
            cronScheduleOf(900_000),
            cronScheduleOf(3_600_000),
            cronScheduleOf(172_800_000),
        ]).toEqual(["1 seconds", "30 seconds", "*/1 * * * *", "*/15 * * * *", "0 */1 * * *", "0 */23 * * *"])
    })
})
