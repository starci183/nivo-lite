import { Test } from "@nestjs/testing"
import { backoffMs, filled, secondsOf } from "./agent-runs.policy"
import { stepSpecOf } from "@tests/fixtures/builders/agent-runs.builder"
import {
    BACKOFF_BASE_MS,
    BACKOFF_MAX_MS,
    DEADLINE_MAX_MS,
    DEADLINE_MIN_MS,
    DEFAULT_DEADLINE_MS,
    DEFAULT_MAX_ATTEMPTS,
    MAX_ATTEMPTS_CEILING,
} from "./agent-runs.policy"

const SUBJECT = Symbol("agent-runs.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { backoffMs, filled, secondsOf } }],
    }).compile()
    return moduleRef.get<typeof import("./agent-runs.policy")>(SUBJECT)
}

describe("backoffMs", () => {
    it("starts at the base and doubles with each failed try", async () => {
        const { backoffMs } = await buildSubject()
        expect(backoffMs(1)).toBe(BACKOFF_BASE_MS)
        expect(backoffMs(2)).toBe(BACKOFF_BASE_MS * 2)
        expect(backoffMs(3)).toBe(BACKOFF_BASE_MS * 4)
    })

    it("never passes the ceiling, however many tries failed", async () => {
        const { backoffMs } = await buildSubject()
        expect(backoffMs(30)).toBe(BACKOFF_MAX_MS)
        expect(backoffMs(1000)).toBe(BACKOFF_MAX_MS)
    })

    it("treats a try count below one as the first", async () => {
        const { backoffMs } = await buildSubject()
        expect(backoffMs(0)).toBe(BACKOFF_BASE_MS)
        expect(backoffMs(-5)).toBe(BACKOFF_BASE_MS)
    })
})

describe("secondsOf", () => {
    it("rounds a pause up to whole seconds", async () => {
        const { secondsOf } = await buildSubject()
        expect(secondsOf(1)).toBe(1)
        expect(secondsOf(2000)).toBe(2)
        expect(secondsOf(2001)).toBe(3)
    })
})

describe("filled", () => {
    it("gives a spec that names no budget the defaults", async () => {
        const { filled } = await buildSubject()
        const spec = filled(stepSpecOf())

        expect(spec.maxAttempts).toBe(DEFAULT_MAX_ATTEMPTS)
        expect(spec.deadlineMs).toBe(DEFAULT_DEADLINE_MS)
    })

    it("keeps a budget the spec names", async () => {
        const { filled } = await buildSubject()
        const spec = filled(stepSpecOf({ maxAttempts: 5, deadlineMs: 30_000 }))

        expect(spec.maxAttempts).toBe(5)
        expect(spec.deadlineMs).toBe(30_000)
    })

    it("bounds a budget that is too small or too large, and drops a fraction", async () => {
        const { filled } = await buildSubject()
        expect(filled(stepSpecOf({ maxAttempts: 0, deadlineMs: 5 }))).toMatchObject({
            maxAttempts: 1,
            deadlineMs: DEADLINE_MIN_MS,
        })
        expect(filled(stepSpecOf({ maxAttempts: 99, deadlineMs: 99_999_999 }))).toMatchObject({
            maxAttempts: MAX_ATTEMPTS_CEILING,
            deadlineMs: DEADLINE_MAX_MS,
        })
        expect(filled(stepSpecOf({ maxAttempts: 2.9 })).maxAttempts).toBe(2)
    })

    it("keeps the rest of the spec as it was", async () => {
        const { filled } = await buildSubject()
        const spec = filled(stepSpecOf({ input: { a: 1 } }))

        expect(spec).toMatchObject({ stepKey: "tool-1", nodeKey: "node-tool", kind: "tool", input: { a: 1 } })
    })
})
