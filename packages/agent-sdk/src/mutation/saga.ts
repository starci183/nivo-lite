import type { AnyEntityDefinition } from "../entity/entity-any.types"
import { isNamespaced } from "../schema/namespaced"
import type { JobRef } from "./job"
import { entityOf } from "./mutation-problems"
import { SagaDefinitionError, type SagaProblemCode } from "./saga-definition-error"

/** The most steps one saga declares. */
export const SAGA_STEPS_MAX = 20

/** One step: the job that does it and the job that undoes every effect of it (BE-SAGA-1: every step has a compensation). */
export interface SagaStep {
    /** The job that does the step. */
    readonly job: JobRef
    /** The job that undoes every effect of the step. */
    readonly compensate: JobRef
}

/**
 * A saga as a pure definition (BE-SAGA-1..2): ordered steps of declared jobs, each paired with its compensation, and the state of a
 * run in one engine entity that has a `status` enum (its record version is the fence). The run itself (fenced transitions through the inbox, retry,
 * park and resume) belongs to the runtime, never to this definition.
 */
export interface SagaConfig {
    /** `<module>.<saga>`. */
    readonly name: string
    /** The ordered steps, at least one. */
    readonly steps: readonly [SagaStep, ...Array<SagaStep>]
    /** The name of the entity holding the run state. */
    readonly state: string
}

/** A defined saga. */
export interface SagaDefinition extends SagaConfig {
    /** Discriminant. */
    readonly entry: "saga"
}

/** One problem of a saga declaration. */
export interface SagaProblem {
    /** The code. */
    readonly code: SagaProblemCode
    /** The saga name, or `<saga>.<step job>`, or the state entity. */
    readonly at: string
}

const problem = (code: SagaProblemCode, at: string): SagaProblem => ({ code, at })

/** The problems of one step: the same job twice in the saga, a compensation that is its own step, a compensation taking an id its step does not carry. */
const stepProblems = (saga: SagaConfig, step: SagaStep, index: number): ReadonlyArray<SagaProblem> => {
    const at = `${saga.name}.${step.job.name}`
    const carried = Object.keys(step.job.input.shape)
    return [
        ...(saga.steps.findIndex((other) => other.job.name === step.job.name) === index
            ? []
            : [problem("SAGA_STEP_DUPLICATE", at)]),
        ...(step.compensate.name === step.job.name ? [problem("SAGA_COMPENSATION_SELF", at)] : []),
        ...(Object.keys(step.compensate.input.shape).every((key) => carried.includes(key))
            ? []
            : [problem("SAGA_COMPENSATION_INPUT_MISMATCH", at)]),
    ]
}

/** What is wrong with a saga declaration alone, empty when it is sound (no entity catalog needed). */
export const sagaDefinitionProblems = (saga: SagaConfig): ReadonlyArray<SagaProblem> => [
    ...(isNamespaced(saga.name) ? [] : [problem("SAGA_NAME_MALFORMED", saga.name)]),
    ...(saga.steps.length <= SAGA_STEPS_MAX ? [] : [problem("SAGA_STEPS_TOO_MANY", saga.name)]),
    ...saga.steps.flatMap((step, index) => stepProblems(saga, step, index)),
]

/** The problems of the state entity: it must exist and hold a `status` enum; its record version is the fence (BE-SAGA-2). */
const stateProblems = (state: AnyEntityDefinition): ReadonlyArray<SagaProblem> =>
    state.fields["status"]?.kind === "enum" ? [] : [problem("SAGA_STATE_STATUS_MISSING", state.name)]

/** What is wrong with a saga against the declared entities: its own problems and those of its state entity. */
export const sagaProblems = (
    saga: SagaConfig,
    entities: ReadonlyArray<AnyEntityDefinition>,
): ReadonlyArray<SagaProblem> => {
    const state = entityOf(entities, saga.state)
    return [
        ...sagaDefinitionProblems(saga),
        ...(state === undefined ? [problem("SAGA_STATE_UNKNOWN", saga.state)] : stateProblems(state)),
    ]
}

/** Defines a saga. Throws `SagaDefinitionError` for the first problem of `sagaDefinitionProblems`, at module load. */
export const defineSaga = (config: SagaConfig): SagaDefinition => {
    const [first] = sagaDefinitionProblems(config)
    if (first !== undefined) throw new SagaDefinitionError(first.code, first.at)
    return { ...config, entry: "saga" }
}
