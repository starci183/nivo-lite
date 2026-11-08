import { Injectable } from "@nestjs/common"
import type { ErrorParams } from "@modules/platform/errors"
import { InjectIds, type Ids } from "@modules/platform/ids"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { EntityEngineLogEvent } from "./entity-engine.log-events"
import { EntityEngineError, EntityEngineErrorCode } from "./errors/entity-engine.error"
import { pgFailureOf, type PgFailure } from "./pg-failure.policy"

/** The secret-free cause of an invalid statement: its SQLSTATE, the entity, and the constraint and column the database names; never a value. */
const invalidParamsOf = (failure: Extract<PgFailure, { readonly kind: "invalid" }>, entity: string): ErrorParams => ({
    sqlstate: failure.sqlstate,
    entity,
    ...(failure.constraint === null ? {} : { constraint: failure.constraint }),
    ...(failure.column === null ? {} : { column: failure.column }),
})

@Injectable()
/**
 * What a failed statement becomes. A domain error passes as it is; row-level security (42501) is a logged bug that travels as forbidden
 * with a correlation id; a serialization failure, a deadlock or a lost connection is unavailable (the caller or the queue tries again, no
 * inline retry, BE-RESILIENCE-1); a constraint no declaration lists is a logged gap that travels as a conflict; a refused value is an
 * invalid read; anything else is an internal failure.
 */
export class EngineFailureService {
    constructor(
        @InjectIds() private readonly ids: Ids,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Runs a read of `entity`; a failure of the database is thrown as the engine error that says what it means. */
    async reading<T>(entity: string, work: () => Promise<T>): Promise<T> {
        return await work().catch((cause: unknown) => this.fail(cause, pgFailureOf(cause, []), entity))
    }

    /** Throws the engine error a failure stands for; `entity` names what the statement was about. */
    fail(cause: unknown, failure: PgFailure, entity: string): never {
        if (cause instanceof EntityEngineError) throw cause
        const correlationId = this.ids.next()
        if (failure.kind === "scope") {
            this.logger.error(EntityEngineLogEvent.ScopeViolation, cause, { correlationId })
            throw new EntityEngineError({
                code: EntityEngineErrorCode.ScopeViolation,
                params: { correlationId },
                cause,
            })
        }
        if (failure.kind === "transient")
            throw new EntityEngineError({ code: EntityEngineErrorCode.Unavailable, cause })
        if (failure.kind === "undeclared") {
            this.logger.warn(EntityEngineLogEvent.ConstraintUndeclared, {
                constraint: failure.constraint,
                correlationId,
            })
            throw new EntityEngineError({
                code: EntityEngineErrorCode.ConstraintUndeclared,
                params: { constraint: failure.constraint },
                cause,
            })
        }
        if (failure.kind === "invalid") {
            const params = invalidParamsOf(failure, entity)
            this.logger.warn(EntityEngineLogEvent.QueryInvalid, { ...params, correlationId })
            throw new EntityEngineError({ code: EntityEngineErrorCode.QueryInvalid, params, cause })
        }
        this.logger.error(EntityEngineLogEvent.StatementFailed, cause, { correlationId })
        throw new EntityEngineError({ code: EntityEngineErrorCode.Failed, params: { correlationId }, cause })
    }
}
