import { AsyncLocalStorage } from "node:async_hooks"

/**
 * What the current work is, for the meter: the kind of work (`node`, `engine_core`, `document_read`, `document_reread`,
 * `document_critique`, `learning`, `chat_turn`), the record it is done for (`source:<id>`, `lesson:<id>`, `message:<room>/<id>`), and
 * for engine work the step and the agent. Every field but the kind is optional: an inner scope names only what it knows.
 */
export interface WorkScope {
    /** The kind of work. */
    readonly kind: string
    /** The record the work is done for, `<what>:<id>`; absent when the run and step say it. */
    readonly ref?: string | null | undefined
    /** The step key of the run step a graph node runs for. */
    readonly stepKey?: string | null | undefined
    /** The agent the work is done by. */
    readonly agentId?: string | null | undefined
}

/** The work a scope holds: whatever it awaits is in the scope. */
type WorkScopeWork<T> = () => Promise<T>

const scope = new AsyncLocalStorage<WorkScope>()

/** The scope inside an outer one: the inner kind, and each other field from the inner scope when it names one, else the outer one. */
const nestedOf = (outer: WorkScope | undefined, inner: WorkScope): WorkScope => ({
    kind: inner.kind,
    ref: inner.ref ?? outer?.ref ?? null,
    stepKey: inner.stepKey ?? outer?.stepKey ?? null,
    agentId: inner.agentId ?? outer?.agentId ?? null,
})

/** Runs `work` as the work given: every model call it awaits is booked with that kind, record, step and agent. */
export const withWorkScope = <T>(work: WorkScope, run: WorkScopeWork<T>): Promise<T> =>
    scope.run(nestedOf(scope.getStore(), work), run)

/** The work the current call belongs to, or null when no work scope is open. */
export const workInScope = (): WorkScope | null => scope.getStore() ?? null
