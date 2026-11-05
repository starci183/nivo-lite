import { SdkError } from "../sdk-error"
import type { EntityProblem, EntityProblemCode } from "./entity.types"

/** The codes an entity declaration, a sequence value or a reader is refused with. */
export type EntityErrorCode = EntityProblemCode | "ENTITY_SEQUENCE_VALUE_INVALID"

/**
 * Thrown at module load by `defineEntity`, and by the pure helpers (`formatSequence`, `rowSchemaOf`) given a declaration or a
 * value they cannot honour. `problems` lists every refusal `defineEntity` found, the first one is the code and `at`.
 */
export class EntityDefinitionError extends SdkError<EntityErrorCode> {
    /** Every problem found; one entry for the errors the helpers throw. */
    readonly problems: ReadonlyArray<EntityProblem>

    constructor(
        code: EntityErrorCode,
        at: string,
        problems: ReadonlyArray<EntityProblem> = [],
        options?: ErrorOptions,
    ) {
        super(code, at, options)
        this.problems = problems
    }
}
