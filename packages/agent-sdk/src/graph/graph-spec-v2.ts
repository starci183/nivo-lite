import type {
    GraphV2LoopOverStep,
    GraphV2LoopStep,
    GraphV2LoopUntilStep,
    LoopUntil,
    LoopUntilRoute,
    StoredLeaf,
    StoredPresence,
} from "./graph-spec-v2.types"

/** The step id of a data condition. */
export const IF_STEP = "core.if"

/** Whether a stored leaf is a presence test. */
export const isStoredPresence = (leaf: StoredLeaf): leaf is StoredPresence =>
    leaf.op === "present" || leaf.op === "absent"

/** The step id of a loop (`over` a list or `until` a condition). */
export const LOOP_STEP_V2 = "core.loop"

/** The most items one `over` loop runs; the rest are held (counted in the loop's `held`), never run, never a failure. */
export const LOOP_OVER_CAP = 50

/** The most rounds one `until` loop runs; past it without the condition the run goes the loop's `exhausted` route. */
export const LOOP_UNTIL_CAP = 10

/**
 * The most rounds of an `until` loop whose body holds a `wait` (a talk loop: each round parks the run, holds no slot, and is bounded in
 * time by the wait's timeout), coordinator ruling R9 2026-11-14; every other `until` loop keeps `LOOP_UNTIL_CAP`.
 */
export const LOOP_UNTIL_WAIT_CAP = 30

/**
 * The item key of an `over` loop whose items are plain values (texts, numbers): the item ITSELF is its identity (`loop({ over, key: "." })`),
 * so a list of service codes is keyed by the code, never by its place in the list. Legal only on a list of strings or numbers; a number
 * is keyed by its decimal text.
 */
export const LOOP_ITEM_SELF_KEY = "."

/** The most items of an `over` loop that run at once, and its default; a graph may lower it, never raise it. */
export const LOOP_CONCURRENCY_CAP = 5

/** The route of a loop to the first step of its body. */
export const LOOP_BODY_ROUTE = "body"

/** The route of an `until` loop when its rounds ran out without the condition. */
export const LOOP_EXHAUSTED_ROUTE = "exhausted"

/** The most notice facts one step (or one `until` loop) declares on its `unsuccessful` ending (R68). */
export const UNSUCCESSFUL_FACTS_MAX = 6

/** The bounds of a timed checkpoint between two rounds, per unit (whole numbers). */
export const LOOP_EVERY_BOUNDS: { readonly minutes: number; readonly hours: number; readonly days: number } = {
    minutes: 1440,
    hours: 720,
    days: 30,
}

/** The step id of a wait (`wait`). */
export const WAIT_STEP = "core.wait"

/** The step id of a hand-back (`handBack`): the event a wait took is offered on to whoever else waits for it. */
export const HAND_BACK_STEP = "core.hand-back"

/** The route, and the `trigger` of the output, when a wait's time ran out. */
export const WAIT_TIMEOUT_ROUTE = "timeout"

/** The most triggers one wait listens for. */
export const WAIT_TRIGGERS_MAX = 5

/** The member of a wait's output that names what came (a trigger key, or `timeout`): the member it routes by. */
export const WAIT_ROUTE_MEMBER = "trigger"

/** The deepest an expression may nest: a leaf is depth 1, each `and` / `or` / `not` adds one. */
export const EXPR_DEPTH_MAX = 4

/** The most leaves one expression may hold. */
export const EXPR_LEAVES_MAX = 16

/** Whether an `until` stops on a route of a body node (by meaning) rather than an expression (by data). */
export const isUntilRoute = (until: LoopUntil): until is LoopUntilRoute => "route" in until && "stop" in until

/** Whether a loop runs over a list (`params.mode` is `over`): the step typed so. */
export const isLoopOver = (step: GraphV2LoopStep): step is GraphV2LoopOverStep => step.params.mode === "over"

/** Whether a loop runs until a condition (`params.mode` is `until`): the step typed so. */
export const isLoopUntil = (step: GraphV2LoopStep): step is GraphV2LoopUntilStep => step.params.mode === "until"

/** @deprecated The old loop step id, read from stored drafts only: `LOOP_STEP_V2`. */
export const FOR_EACH_STEP = "core.for-each"

/** @deprecated `LOOP_OVER_CAP`. */
export const FOR_EACH_CAP: typeof LOOP_OVER_CAP = LOOP_OVER_CAP

/** @deprecated `LOOP_BODY_ROUTE`. */
export const FOR_EACH_BODY_ROUTE: typeof LOOP_BODY_ROUTE = LOOP_BODY_ROUTE

/** The step id of an end hand-off. */
export const CALL_WORKFLOW_STEP_V2 = "core.call-workflow"

/** The step id of a named business end. */
export const OUTCOME_STEP_V2 = "core.outcome"
