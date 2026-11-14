import { CALL_WORKFLOW_STEP } from "@nivo-lite/agent-sdk/graph"
import { BRANCH_FIELD, LOOP_STEP, OUTCOME_STEP, iterationKeyOf } from "@nivo-lite/agent-sdk/node"
import type { UntilSettings } from "@modules/domain/agent-graphs"
import type { StepJson } from "@modules/domain/agent-runs"
import { TEMPLATE_IF_STEP, TEMPLATE_UNTIL_STEP, TEMPLATE_WAIT_STEP } from "@modules/domain/installed-plugins"
import type { IterationInput } from "./compiler-loop.policy"
import type { CompiledStep } from "./template-compiler.policy"
import { routeByOfStep } from "./template-steps.policy"
import { TEMPLATE_HAND_BACK_STEP } from "./thread-hand-back.policy"

/*
 * `loop({ until })` on a thread, the run half: the ROUND COUNTER and the moves of the loop node, as plain JSON in `state.loop` (the
 * checkpoint keeps it). Rounds are 1-based. A body node of round r runs under the step key `<loop>[r<r>].<node>` (`iterationKeyOf`, the
 * same form as an item of a list loop: the ledger, the memory and the stops of one round are its own) and reads `ctx.run.item` as
 * `{ key: "r<r>", index: r - 1 }`. While a round runs the frame keeps the output of the last NODE step that completed in it (ruling R46,
 * the SDK's `last`: a control step, an `if` above all, answers nothing and never becomes it); when a round ends (a body step goes back to
 * the loop node, a node or a control step alike) the frame keeps when and that last node output and, for a loop by MEANING, the route
 * its named node took. The loop node then judges: the condition holds →
 * `next`; `max` rounds ran → `exhausted`; else the next round, at once or, with `every`, after a park (an interrupt and an engine timer)
 * until `round end + every`. Pure.
 */

/** A value a step kept (plain JSON). */
export type RoundValue = StepJson[string]

/** The `kind` of an until frame in `state.loop` (a list loop's frame has none). */
export const UNTIL_FRAME_KIND = "until"

/** How a round ended: when, and what the round's last NODE step answered (null for a node passed over, or no node step ran). */
export interface UntilRoundEnd {
    /** The instant (ISO 8601) the round's last step (the one that went back to the loop node) completed. */
    readonly at: string
    /** The output of the last node step of the round (never a control step's), or null. */
    readonly output: RoundValue
}

/** The until loop in progress, as `state.loop` keeps it. */
export interface UntilFrame {
    /** `UNTIL_FRAME_KIND`. */
    readonly kind: typeof UNTIL_FRAME_KIND
    /** The loop node. */
    readonly nodeKey: string
    /** The round that runs (or, once `ended` is set, the round that just ended), from 1. */
    readonly round: number
    /** The route the meaning node took in this round, or null (no meaning node, or it has not completed in this round). */
    readonly route: string | null
    /** The output of the last node step that completed in this round (R46), null before any (or for a node passed over). */
    readonly last: RoundValue
    /** How this round ended, once a body step went back to the loop node; null while it runs. */
    readonly ended: UntilRoundEnd | null
}

/** The frame of an until loop, or null. */
export type OptionalUntilFrame = UntilFrame | null

/** The output of an until loop once it is over, the one thing the steps after it read. */
export interface UntilOutput {
    /** How many rounds ran. */
    readonly rounds: number
    /** True when the condition held (the loop went to `next`); false when `max` rounds ran without it (`exhausted`). */
    readonly stopped: boolean
    /** The output of the last NODE step of the last round (R46: never a control step's), or null when none ran. */
    readonly last: RoundValue
}

/** What the loop node does after a round ended. */
export type UntilJudgement =
    | {
          /** The condition held: the output, then `next`. */
          readonly kind: "stopped"
          readonly output: UntilOutput
      }
    | {
          /** `max` rounds ran without it: the output, then `exhausted`. */
          readonly kind: "exhausted"
          readonly output: UntilOutput
      }
    | {
          /** Another round: the frame it runs under, and the instant it may start (null: at once). */
          readonly kind: "again"
          readonly frame: UntilFrame
          readonly dueAt: string | null
      }

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** The prefix of a round's key (`r1`, `r2`, …): never a list item's index, which is a bare number. */
const ROUND_PREFIX = "r"

/** The key of a round, as a body step's key and `ctx.run.item.key` carry it. */
export const roundKeyOf = (round: number): string => `${ROUND_PREFIX}${String(round)}`

/** The frame `state.loop` holds when it is an until loop's, else null. */
export const untilFrameOf = (value: unknown): OptionalUntilFrame => {
    if (!isRecord(value) || value.kind !== UNTIL_FRAME_KIND) return null
    const { nodeKey, round, route, last, ended } = value
    if (typeof nodeKey !== "string" || typeof round !== "number" || !Number.isInteger(round) || round < 1) return null
    const end =
        isRecord(ended) && typeof ended.at === "string" ? { at: ended.at, output: ended.output ?? null } : null
    return {
        kind: UNTIL_FRAME_KIND,
        nodeKey,
        round,
        route: typeof route === "string" ? route : null,
        last: last ?? null,
        ended: end,
    }
}

/** The frame of a loop that starts: round 1 runs. */
export const untilStarted = (loopKey: string): UntilFrame => ({
    kind: UNTIL_FRAME_KIND,
    nodeKey: loopKey,
    round: 1,
    route: null,
    last: null,
    ended: null,
})

/**
 * The engine's CONTROL steps (the @2 kinds that are not `node`: `if`, `wait`, `hand-back`, the loops, `outcome`, `call-workflow`): they
 * answer nothing a loop's `last` may carry (the SDK types an `if` as answering nothing; ruling R46).
 */
const CONTROL_STEP_IDS: ReadonlySet<string> = new Set([
    TEMPLATE_IF_STEP,
    TEMPLATE_UNTIL_STEP,
    TEMPLATE_WAIT_STEP,
    TEMPLATE_HAND_BACK_STEP,
    LOOP_STEP,
    OUTCOME_STEP,
    CALL_WORKFLOW_STEP,
])

/** Whether a compiled step is a NODE step (its output may be a loop's `last`), not one of the engine's control steps. */
export const isNodeStep = (step: Pick<CompiledStep, "step">): boolean => !CONTROL_STEP_IDS.has(step.step)

/** Whether a compiled step is a node of the body of the until loop the frame runs. */
export const inRound = (step: Pick<CompiledStep, "inLoop">, frame: OptionalUntilFrame): frame is UntilFrame =>
    frame !== null && step.inLoop === frame.nodeKey

/** The step key a body node of the running round runs under (`<loop>[r<round>].<node>`), or null outside the round. */
export const roundStepKeyOf = (step: Pick<CompiledStep, "key" | "inLoop">, frame: OptionalUntilFrame): string | null =>
    inRound(step, frame) ? iterationKeyOf(frame.nodeKey, roundKeyOf(frame.round), step.key) : null

/** The member of a round's item value that its number is read by (`item.$round`, the SDK builder's `round()`; `item.$index` = r - 1). */
export const ROUND_MEMBER = "$round"

/**
 * What a body node's input carries in a round: the round as the item (`{ key: "r<r>", index: r - 1 }`, its value `{ $round: r }` so
 * `item.$round` reads the round's number) and the loop.
 */
export const roundInputOf = (frame: UntilFrame): IterationInput => ({
    item: { value: { [ROUND_MEMBER]: frame.round }, index: frame.round - 1, key: roundKeyOf(frame.round) },
    loop: { nodeKey: frame.nodeKey, index: frame.round - 1, items: [] },
})

/**
 * The route a routing node answered: the member its compiled exit routes by (a template node's `routes.by`, else `branch`), read from
 * its output; null when it names none.
 */
export const routeOfOutput = (step: Pick<CompiledStep, "exit" | "step">, output: RoundValue): string | null => {
    const field = step.exit.kind === "branch" ? step.exit.field : (routeByOfStep(step.step) ?? BRANCH_FIELD)
    const route: unknown = isRecord(output) ? output[field] : undefined
    return typeof route === "string" ? route : null
}

/**
 * The frame once a body step of the running round completed (`output`, null for a node passed over): the meaning node's route is kept
 * for the round; a NODE step's output becomes the round's `last` (a control step, an `if` above all, leaves it as it was: ruling R46);
 * when the step goes back to the loop node (`toLoop`) the round ended at `at` with that last node output (null when no node step ran in
 * the round). Null when nothing changes.
 */
export const roundLeft = (
    frame: UntilFrame,
    step: Pick<CompiledStep, "key" | "exit" | "step">,
    settings: Pick<UntilSettings, "until"> | null,
    left: { readonly output: RoundValue; readonly toLoop: boolean; readonly at: string },
): OptionalUntilFrame => {
    const meaning = settings?.until.kind === "meaning" && settings.until.node === step.key
    const routed = meaning ? { ...frame, route: routeOfOutput(step, left.output) } : frame
    const kept = isNodeStep(step) ? { ...routed, last: left.output } : routed
    if (!left.toLoop) return kept === frame ? null : kept
    return { ...kept, ended: { at: left.at, output: kept.last } }
}

/** Whether a loop by MEANING stops after the round: its named node took the `stop` route in this round. */
export const meaningHolds = (frame: UntilFrame, settings: UntilSettings): boolean =>
    settings.until.kind === "meaning" && frame.route === settings.until.stop

/**
 * What the loop node does after round `frame.round` ended, given whether the condition holds: stop (→ `next`), exhausted (→ after
 * `max` rounds), or the next round, due at `round end + every` when the loop waits between rounds. The output names how many rounds ran,
 * whether the condition held and the round's last output.
 */
export const untilJudged = (frame: UntilFrame, settings: UntilSettings, holds: boolean): UntilJudgement => {
    const last = frame.ended?.output ?? null
    if (holds) return { kind: "stopped", output: { rounds: frame.round, stopped: true, last } }
    if (frame.round >= settings.max) return { kind: "exhausted", output: { rounds: frame.round, stopped: false, last } }
    const endedAt = frame.ended === null ? null : Date.parse(frame.ended.at)
    const dueAt =
        settings.everyMs === null || endedAt === null || Number.isNaN(endedAt)
            ? null
            : new Date(endedAt + settings.everyMs).toISOString()
    return { kind: "again", frame: { ...frame, round: frame.round + 1, route: null, last: null, ended: null }, dueAt }
}

/** The `kind` of the question a parked loop's interrupt carries (never a stop: it names no `stepKey`, so no stop door reads it). */
export const UNTIL_PARK_KIND = "until_round"

/**
 * What a loop parked between two rounds hands LangGraph's `interrupt` (plain JSON, in the checkpoint): the round that waits to start,
 * when it may, and the key its engine timer is filed under (`<loop>[r<round>]`, which no step key takes).
 */
export interface UntilPark {
    /** `UNTIL_PARK_KIND`. */
    readonly kind: typeof UNTIL_PARK_KIND
    /** The loop node. */
    readonly loopKey: string
    /** The round that starts when the timer fires. */
    readonly round: number
    /** When it may start (ISO 8601). */
    readonly dueAt: string
    /** The key the timer is filed under. */
    readonly parkKey: string
}

/** The park of the round `round` of a loop, due at `dueAt`. */
export const untilParkOf = (loopKey: string, round: number, dueAt: string): UntilPark => ({
    kind: UNTIL_PARK_KIND,
    loopKey,
    round,
    dueAt,
    parkKey: `${loopKey}[${roundKeyOf(round)}]`,
})

/** The park a stopped thread's question is, or null for any other question (a stop for a person). */
export const parkOfQuestion = (question: unknown): UntilPark | null => {
    if (!isRecord(question) || question.kind !== UNTIL_PARK_KIND) return null
    const { loopKey, round, dueAt } = question
    if (typeof loopKey !== "string" || typeof round !== "number" || typeof dueAt !== "string") return null
    return untilParkOf(loopKey, round, dueAt)
}

/** The decision a fired timer resumes a parked thread with: the park it answers. */
export interface UntilRoundDecision {
    /** `UNTIL_PARK_KIND`. */
    readonly kind: typeof UNTIL_PARK_KIND
    /** The key of the park. */
    readonly parkKey: string
    /** The round that starts. */
    readonly round: number
    /** When the timer fired (ISO 8601). */
    readonly at: string
}

/**
 * The mark a timer job of a park carries in the thread-deadline payload's `answered` member: a stop's count of answers is never
 * negative, so a park's job is never read as a stop's deadline (and the job's dedupe key is one per park).
 */
export const UNTIL_PARK_ANSWERED = -1

/** The thread-deadline payload of a park's timer: `stepKey` = the park key, `repeats` = the round, `answered` = the park mark. */
export interface UntilParkPayload {
    /** The workspace of the run. */
    readonly workspaceId: string
    /** The run the timer belongs to. */
    readonly runId: string
    /** The park key. */
    readonly stepKey: string
    /** The round of the park (0 for a wait). */
    readonly repeats: number
    /** The park mark the drain tells a timer by. */
    readonly answered: number
}

/** The payload of the timer of a park. */
export const parkPayloadOf = (ref: { readonly workspaceId: string; readonly runId: string }, park: UntilPark): UntilParkPayload => ({
    workspaceId: ref.workspaceId,
    runId: ref.runId,
    stepKey: park.parkKey,
    repeats: park.round,
    answered: UNTIL_PARK_ANSWERED,
})

/** Whether a thread-deadline payload is a park's timer (rather than a stop's deadline). */
export const isParkPayload = (payload: Pick<UntilParkPayload, "answered">): boolean => payload.answered === UNTIL_PARK_ANSWERED

/** Whether a park is the one a timer was filed for. */
export const parkMatches = (park: UntilPark, payload: Pick<UntilParkPayload, "stepKey" | "repeats">): boolean =>
    park.parkKey === payload.stepKey && park.round === payload.repeats
