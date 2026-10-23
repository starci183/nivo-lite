import { Test } from "@nestjs/testing"
import { summarize } from "./chain-summary.policy"
import type { SummarizedStep } from "./chain-summary.policy"

const SUBJECT = Symbol("chain-summary.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { summarize } }],
    }).compile()
    return moduleRef.get<typeof import("./chain-summary.policy")>(SUBJECT)
}

const step = (overrides: Partial<SummarizedStep>): SummarizedStep => ({
    kind: "self",
    status: "done",
    decidedBy: null,
    startedAt: "2026-10-22T09:41:00.000Z",
    finishedAt: "2026-10-22T09:41:00.000Z",
    ...overrides,
})

const NOW = new Date("2026-10-22T10:30:00.000Z")

describe("chain summary policy", () => {
    it("reads an empty chain as empty", async () => {
        const subject = await buildSubject()

        expect(subject.summarize([], NOW)).toEqual({ steps: 0, humanDecisions: 0, minutes: 0, state: "empty" })
    })

    it("counts the steps, the decisions people made and the minutes of the video chain: 6 steps, 2 decisions", async () => {
        const subject = await buildSubject()
        const steps = [
            step({ kind: "assign" }),
            step({
                kind: "ask_approval",
                decidedBy: "minh",
                startedAt: "2026-10-22T09:41:00.000Z",
                finishedAt: "2026-10-22T09:42:00.000Z",
            }),
            step({ kind: "hand_off", startedAt: "2026-10-22T09:42:00.000Z", finishedAt: "2026-10-22T09:43:00.000Z" }),
            step({
                kind: "hand_off",
                decidedBy: "van",
                startedAt: "2026-10-22T09:43:00.000Z",
                finishedAt: "2026-10-22T09:44:00.000Z",
            }),
            step({ kind: "hand_off", startedAt: "2026-10-22T09:44:00.000Z", finishedAt: "2026-10-22T09:44:30.000Z" }),
            step({ kind: "self", startedAt: "2026-10-22T09:44:30.000Z", finishedAt: "2026-10-22T09:45:00.000Z" }),
        ]

        expect(subject.summarize(steps, NOW)).toEqual({ steps: 6, humanDecisions: 2, minutes: 4, state: "complete" })
    })

    it("ends a finished step with no end instant at its start", async () => {
        const subject = await buildSubject()
        const steps = [step({ finishedAt: null })]

        expect(subject.summarize(steps, NOW)).toEqual({ steps: 1, humanDecisions: 0, minutes: 0, state: "complete" })
    })

    it("does not count an approval nobody decided as a decision", async () => {
        const subject = await buildSubject()
        const steps = [step({ kind: "ask_approval", status: "expired", decidedBy: null })]

        expect(subject.summarize(steps, NOW).humanDecisions).toBe(0)
    })

    it("measures to now while a step still waits and reports the chain as running", async () => {
        const subject = await buildSubject()
        const steps = [step({ kind: "ask_approval", status: "waiting", finishedAt: null })]

        expect(subject.summarize(steps, NOW)).toEqual({ steps: 1, humanDecisions: 0, minutes: 49, state: "running" })
    })

    it("reports a chain the limits stopped as stopped even while another step waits", async () => {
        const subject = await buildSubject()
        const steps = [step({ status: "stopped" }), step({ kind: "hand_off", status: "waiting", finishedAt: null })]

        expect(subject.summarize(steps, NOW).state).toBe("stopped")
    })
})
