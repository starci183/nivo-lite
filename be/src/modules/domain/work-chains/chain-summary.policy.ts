import type { ChainStep, ChainSummary } from "./work-chains.contracts"

/** The part of a step the summary reads. */
export type SummarizedStep = Pick<ChainStep, "kind" | "status" | "decidedBy" | "startedAt" | "finishedAt">

const MINUTE_MS = 60_000

/** A stopped chain stays stopped; otherwise it runs while a step waits and is complete when none does. */
const stateOf = (steps: ReadonlyArray<SummarizedStep>, waiting: boolean): ChainSummary["state"] => {
    if (steps.some((step) => step.status === "stopped")) return "stopped"
    return waiting ? "running" : "complete"
}

/** The summary line of a chain: how many steps, how many times a person decided, how many minutes, and whether it still runs. */
export const summarize = (steps: ReadonlyArray<SummarizedStep>, now: Date): ChainSummary => {
    if (steps.length === 0) return { steps: 0, humanDecisions: 0, minutes: 0, state: "empty" }
    const waiting = steps.some((step) => step.status === "waiting")
    const begun = Math.min(...steps.map((step) => Date.parse(step.startedAt)))
    const ended = waiting
        ? now.getTime()
        : Math.max(...steps.map((step) => Date.parse(step.finishedAt ?? step.startedAt)))
    return {
        steps: steps.length,
        humanDecisions: steps.filter((step) => step.decidedBy !== null).length,
        minutes: Math.max(0, Math.round((ended - begun) / MINUTE_MS)),
        state: stateOf(steps, waiting),
    }
}
