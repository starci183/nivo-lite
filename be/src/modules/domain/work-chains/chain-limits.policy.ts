import { LOOP_REPEATS, MAX_AUTOMATIC_STEPS } from "./work-chains.contracts"
import type { JudgedStep, StepVerdict } from "./work-chains.contracts"

/** The steps agents took since a person last acted: the run no person has looked at. */
export const automaticRun = (history: ReadonlyArray<JudgedStep>): ReadonlyArray<JudgedStep> =>
    history.slice(history.reduce((start, step, index) => (step.actor.kind === "member" ? index + 1 : start), 0))

/** The key of "this agent pair does this": order-free in the pair, blind to case and spacing in the action. */
const pairKey = (first: string, second: string, action: string): string =>
    `${[first, second].sort((left, right) => left.localeCompare(right)).join("|")}|${action.trim().toLowerCase()}`

/** The key of a step that hands work from an agent to another agent; null for any other step. */
const agentPairKeyOf = (step: JudgedStep): string | null =>
    step.actor.kind === "agent" && step.target?.kind === "agent"
        ? pairKey(step.actor.id, step.target.id, step.action)
        : null

/**
 * Judges the next step of a chain against its history: an agent may not run more than the automatic limit without a person
 * in between, and the same agent pair may not repeat the same action more than the loop limit. A person's step always goes on.
 */
export const judgeStep = (history: ReadonlyArray<JudgedStep>, next: JudgedStep): StepVerdict => {
    if (next.actor.kind === "member") return { kind: "continue" }
    const run = automaticRun(history).filter((step) => step.actor.kind === "agent")
    const key = agentPairKeyOf(next)
    if (key !== null && run.filter((step) => agentPairKeyOf(step) === key).length >= LOOP_REPEATS) {
        return { kind: "stop", reason: "loop" }
    }
    if (run.length >= MAX_AUTOMATIC_STEPS) return { kind: "stop", reason: "limit" }
    return { kind: "continue" }
}
