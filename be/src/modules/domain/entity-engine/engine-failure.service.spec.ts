import { Test } from "@nestjs/testing"
import { fakeIds, mock } from "@starci/jest-preset"
import { IDS } from "@modules/platform/ids"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { EngineFailureService } from "./engine-failure.service"
import { EntityEngineLogEvent } from "./entity-engine.log-events"
import { EntityEngineError, EntityEngineErrorCode } from "./errors/entity-engine.error"
import { pgFailureOf } from "./pg-failure.policy"

const CORRELATION_ID = "00000000-0000-4000-8000-000000000001"

const pgError = (code: string, constraint?: string): Error =>
    Object.assign(new Error("pg failure"), constraint === undefined ? { code } : { code, constraint })

const thrownBy = (work: () => unknown): unknown => {
    try {
        work()
    } catch (error) {
        return error
    }
    return undefined
}

const build = async () => {
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [EngineFailureService, { provide: IDS, useValue: fakeIds() }, { provide: LOGGER, useValue: logger }],
    }).compile()
    return { failures: moduleRef.get(EngineFailureService), logger }
}

describe("EngineFailureService fail", () => {
    it("throws a domain error as it is", async () => {
        const { failures } = await build()
        const cause = new EntityEngineError({ code: EntityEngineErrorCode.JobUnknown })

        expect(thrownBy(() => failures.fail(cause, { kind: "unknown" }, "sales.lead"))).toBe(cause)
    })

    it("throws forbidden and logs a bug with a correlation id when row-level security refused the statement", async () => {
        const { failures, logger } = await build()
        const cause = pgError("42501")

        expect(thrownBy(() => failures.fail(cause, pgFailureOf(cause, []), "sales.lead"))).toMatchObject({
            code: EntityEngineErrorCode.ScopeViolation,
            params: { correlationId: CORRELATION_ID },
        })
        expect(logger.error).toHaveBeenCalledWith(EntityEngineLogEvent.ScopeViolation, cause, {
            correlationId: CORRELATION_ID,
        })
    })

    it("throws unavailable for a serialization failure so the caller or the queue can try again", async () => {
        const { failures } = await build()
        const cause = pgError("40001")

        expect(thrownBy(() => failures.fail(cause, pgFailureOf(cause, []), "sales.lead"))).toMatchObject({
            code: EntityEngineErrorCode.Unavailable,
        })
    })

    it("throws a conflict and logs the gap for a constraint no declaration lists", async () => {
        const { failures, logger } = await build()
        const cause = pgError("23505", "records_other")

        expect(thrownBy(() => failures.fail(cause, pgFailureOf(cause, []), "sales.lead"))).toMatchObject({
            code: EntityEngineErrorCode.ConstraintUndeclared,
            params: { constraint: "records_other" },
        })
        expect(logger.warn).toHaveBeenCalledWith(EntityEngineLogEvent.ConstraintUndeclared, {
            constraint: "records_other",
            correlationId: CORRELATION_ID,
        })
    })

    it("throws an invalid read for a refused value", async () => {
        const { failures } = await build()
        const cause = pgError("22P02")

        expect(thrownBy(() => failures.fail(cause, pgFailureOf(cause, []), "sales.lead"))).toMatchObject({
            code: EntityEngineErrorCode.QueryInvalid,
            params: { sqlstate: "22P02", entity: "sales.lead" },
        })
    })

    it("throws an internal failure and logs it for an error it does not know", async () => {
        const { failures, logger } = await build()
        const cause = new Error("boom")

        expect(thrownBy(() => failures.fail(cause, pgFailureOf(cause, []), "sales.lead"))).toMatchObject({
            code: EntityEngineErrorCode.Failed,
            params: { correlationId: CORRELATION_ID },
        })
        expect(logger.error).toHaveBeenCalledWith(EntityEngineLogEvent.StatementFailed, cause, {
            correlationId: CORRELATION_ID,
        })
    })
})

describe("EngineFailureService fail the cause of an invalid statement", () => {
    it("carries the SQLSTATE, the entity, the constraint and the column of an invalid statement, and logs them, never a value", async () => {
        const { failures, logger } = await build()
        const cause = Object.assign(pgError("23514", "records_payment_transaction_status_chk"), {
            column: "status",
            detail: "Failing row contains (secret value)",
        })

        const thrown = thrownBy(() => failures.fail(cause, pgFailureOf(cause, []), "payment.transaction"))

        expect(thrown).toMatchObject({
            code: EntityEngineErrorCode.QueryInvalid,
            params: {
                sqlstate: "23514",
                entity: "payment.transaction",
                constraint: "records_payment_transaction_status_chk",
                column: "status",
            },
        })
        expect(logger.warn).toHaveBeenCalledWith(EntityEngineLogEvent.QueryInvalid, {
            sqlstate: "23514",
            entity: "payment.transaction",
            constraint: "records_payment_transaction_status_chk",
            column: "status",
            correlationId: CORRELATION_ID,
        })
        expect(JSON.stringify(thrown)).not.toContain("secret value")
    })
})

describe("EngineFailureService reading", () => {
    it("answers what the read answers", async () => {
        const { failures } = await build()

        await expect(failures.reading("sales.lead", () => Promise.resolve(7))).resolves.toBe(7)
    })

    it("throws the engine error a failed read stands for", async () => {
        const { failures } = await build()

        await expect(failures.reading("sales.lead", () => Promise.reject(pgError("40P01")))).rejects.toMatchObject({
            code: EntityEngineErrorCode.Unavailable,
        })
    })
})
