import { Injectable } from "@nestjs/common"
import { InjectIds } from "@modules/platform/ids"
import type { Ids } from "@modules/platform/ids"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { EntityEngineLogEvent } from "./entity-engine.log-events"
import { EntityEngineError, EntityEngineErrorCode } from "./errors/entity-engine.error"
import { pgFailureOf } from "./pg-failure.policy"
import type { PgFailure } from "./pg-failure.policy"
import { EntityCompilerError } from "./policies/compiler.error"

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

    /** Runs a read; a failure of the database is thrown as the engine error that says what it means. */
    async reading<T>(work: () => Promise<T>): Promise<T> {
        return await work().catch((cause: unknown) => this.fail(cause, pgFailureOf(cause, [])))
    }

    /** Throws the engine error a failure stands for. */
    fail(cause: unknown, failure: PgFailure): never {
        if (cause instanceof EntityEngineError || cause instanceof EntityCompilerError) throw cause
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
        if (failure.kind === "invalid") throw new EntityEngineError({ code: EntityEngineErrorCode.QueryInvalid, cause })
        this.logger.error(EntityEngineLogEvent.StatementFailed, cause, { correlationId })
        throw new EntityEngineError({ code: EntityEngineErrorCode.Failed, params: { correlationId }, cause })
    }
}
