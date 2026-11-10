import { Test } from "@nestjs/testing"
import {
    DECISION_ACTOR_UNKNOWN,
    DEFAULT_DEADLINE_MS,
    RUN_CANCELLED,
    RUNS_CONCURRENCY,
    RUNS_CONCURRENCY_MAX,
    SETTLE_TRIES,
    STEPS_MAX,
    TOOL_OUTCOME_UNKNOWN,
} from "./agent-runs.policy"

const SUBJECT = Symbol("agent-runs.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    DECISION_ACTOR_UNKNOWN,
                    DEFAULT_DEADLINE_MS,
                    RUN_CANCELLED,
                    RUNS_CONCURRENCY,
                    RUNS_CONCURRENCY_MAX,
                    SETTLE_TRIES,
                    STEPS_MAX,
                    TOOL_OUTCOME_UNKNOWN,
                },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./agent-runs.policy")>(SUBJECT)
}

describe("agent runs policy", () => {
    it("reads a step row that names no deadline with two minutes, the deadline the thread projection writes", async () => {
        const policy = await buildSubject()
        expect(policy.DEFAULT_DEADLINE_MS).toBe(120_000)
    })

    it("bounds the runs one process drives and the steps one run holds", async () => {
        const policy = await buildSubject()
        expect(policy.RUNS_CONCURRENCY).toBeGreaterThan(0)
        expect(policy.RUNS_CONCURRENCY).toBeLessThanOrEqual(policy.RUNS_CONCURRENCY_MAX)
        expect(policy.STEPS_MAX).toBe(100)
        expect(policy.SETTLE_TRIES).toBeGreaterThan(1)
    })

    it("names the codes the thread engine and the cancel door write, each once", async () => {
        const policy = await buildSubject()
        const codes = [policy.TOOL_OUTCOME_UNKNOWN, policy.DECISION_ACTOR_UNKNOWN, policy.RUN_CANCELLED]
        expect(new Set(codes).size).toBe(codes.length)
        expect(codes).toEqual(["tool_outcome_unknown", "decision_actor_unknown", "run_cancelled"])
    })
})
