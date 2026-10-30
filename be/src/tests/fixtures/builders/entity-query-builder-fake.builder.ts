import { fakeQueryBuilder as presetFakeQueryBuilder } from "@starci/jest-preset"
import type {
    FakeQueryBuilder as PresetFakeQueryBuilder,
    QueryBuilderAnswers,
    QueryBuilderCall,
} from "@starci/jest-preset"

export type { QueryBuilderAnswers, QueryBuilderCall }

/** A chainable stand-in for a typeorm query builder that records every chained call. */
export interface FakeQueryBuilder {
    /** The builder to hand back from `entityManager.createQueryBuilder`; typed `never` so it is assignable to whatever builder type the manager double expects, with no assertion in a spec. */
    readonly builder: never
    /** Every chained call, in order. */
    readonly calls: ReadonlyArray<QueryBuilderCall>
    /** The recorded calls of one builder method. */
    callsOf(method: string): ReadonlyArray<ReadonlyArray<unknown>>
}

/** The part of a manager double that is handed query builders: its mocked `createQueryBuilder`. */
export interface QueryBuilderManager {
    /** The mocked `createQueryBuilder`. */
    readonly createQueryBuilder: QueryBuilderHand
}

/** Queues the builder the next `createQueryBuilder` call answers. */
export interface QueryBuilderHand {
    /** Queues one builder. */
    mockReturnValueOnce(value: never): unknown
}

/**
 * Hands a chainable stand-in over as the builder type the manager double expects; the one place a double is typed `never`.
 * The overload states the narrower type to callers, the implementation signature is the honest one.
 */
export function builderOf(target: object): never
/** The implementation signature of {@link builderOf}: the target, unchanged. */
export function builderOf(target: object): object {
    return target
}

const asFake = (fake: PresetFakeQueryBuilder): FakeQueryBuilder => ({
    builder: builderOf(fake.builder),
    calls: fake.calls,
    callsOf: fake.callsOf,
})

/** Builds a chainable query-builder double: every method returns the builder, the terminal methods answer `answers`. */
export const fakeQueryBuilder = (answers: QueryBuilderAnswers = {}): FakeQueryBuilder =>
    asFake(presetFakeQueryBuilder(answers))

/** Hands out one fake query builder per `createQueryBuilder` call of the manager, in order, and answers them back. */
export const queueQueryBuilders = (
    manager: QueryBuilderManager,
    answers: ReadonlyArray<QueryBuilderAnswers>,
): ReadonlyArray<FakeQueryBuilder> => {
    const fakes = answers.map((answer) => fakeQueryBuilder(answer))
    for (const fake of fakes) manager.createQueryBuilder.mockReturnValueOnce(fake.builder)
    return fakes
}
