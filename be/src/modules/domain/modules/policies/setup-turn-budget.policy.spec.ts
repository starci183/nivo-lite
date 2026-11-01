import { Test } from "@nestjs/testing"
import {
    attemptTimeoutOf as realAttemptTimeoutOf,
    budgetLeftMs as realBudgetLeftMs,
    canAttempt as realCanAttempt,
    canRetry as realCanRetry,
    isTransient as realIsTransient,
} from "./setup-turn-budget.policy"

const SUBJECT = Symbol("setup-turn-budget.policy")

const MESSAGE_AT = "2026-10-01T00:01:00.000Z"

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    attemptTimeoutOf: realAttemptTimeoutOf,
                    budgetLeftMs: realBudgetLeftMs,
                    canAttempt: realCanAttempt,
                    canRetry: realCanRetry,
                    isTransient: realIsTransient,
                },
            },
        ],
    }).compile()
    return moduleRef.get<{
        attemptTimeoutOf: typeof realAttemptTimeoutOf
        budgetLeftMs: typeof realBudgetLeftMs
        canAttempt: typeof realCanAttempt
        canRetry: typeof realCanRetry
        isTransient: typeof realIsTransient
    }>(SUBJECT)
}

describe("budgetLeftMs", () => {
    it("counts 110 s from the owner message", async () => {
        const { budgetLeftMs } = await buildSubject()

        expect(budgetLeftMs(MESSAGE_AT, new Date("2026-10-01T00:01:05.000Z"))).toBe(105_000)
        expect(budgetLeftMs(MESSAGE_AT, new Date("2026-10-01T00:02:55.000Z"))).toBe(-5000)
    })
})

describe("canAttempt", () => {
    it("starts an attempt with 15 s left and not with less", async () => {
        const { canAttempt } = await buildSubject()

        expect(canAttempt(15_000)).toBe(true)
        expect(canAttempt(14_999)).toBe(false)
    })
})

describe("canRetry", () => {
    it("retries when the 5 s pause and 15 s for the next attempt are left and not when less", async () => {
        const { canRetry } = await buildSubject()

        expect(canRetry(20_000)).toBe(true)
        expect(canRetry(19_999)).toBe(false)
    })
})

describe("attemptTimeoutOf", () => {
    it("gives the whole 90 s while the budget allows it and cuts the call to the budget left after", async () => {
        const { attemptTimeoutOf } = await buildSubject()

        expect(attemptTimeoutOf(105_000)).toBe(90_000)
        expect(attemptTimeoutOf(30_000)).toBe(30_000)
    })
})

describe("isTransient", () => {
    it("heals by trying again on an error and a timeout, never on a quota or an engine that is off or not set up", async () => {
        const { isTransient } = await buildSubject()

        expect(isTransient("error")).toBe(true)
        expect(isTransient("timeout")).toBe(true)
        expect(isTransient("quota")).toBe(false)
        expect(isTransient("not_configured")).toBe(false)
        expect(isTransient("engine_offline")).toBe(false)
    })
})
