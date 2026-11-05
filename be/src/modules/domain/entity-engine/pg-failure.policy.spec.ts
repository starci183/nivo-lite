import { Test } from "@nestjs/testing"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import { declaredConstraintsOf, pgFailureOf } from "./pg-failure.policy"

const PG_FAILURE: unique symbol = Symbol("entity-engine.pg-failure")

interface PgFailurePolicy {
    readonly declaredConstraintsOf: typeof declaredConstraintsOf
    readonly pgFailureOf: typeof pgFailureOf
}

const build = async (): Promise<PgFailurePolicy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: PG_FAILURE, useFactory: (): PgFailurePolicy => ({ declaredConstraintsOf, pgFailureOf }) },
        ],
    }).compile()
    return moduleRef.get<PgFailurePolicy>(PG_FAILURE)
}

const LONG_NAME = "a_very_long_constraint_name_that_goes_past_the_limit_of_sixty_three_characters"

const LEAD: EntityDefinition = {
    entry: "entity",
    name: "sales.lead",
    dataKind: "sales-lead",
    fields: { phone: { kind: "text", nullable: true, maxLength: 30 } },
    constraints: [
        { kind: "check", name: "phone_short", expr: { op: "notNull", field: "phone" }, refusal: "phone_missing" },
        { kind: "unique", name: "phone_taken", on: ["phone"], refusal: "phone_taken" },
        { kind: "noOverlap", name: LONG_NAME, equal: ["phone"], range: ["phone", "phone"], refusal: "slot_taken" },
    ],
}

describe("declaredConstraintsOf", () => {
    it("lists the unique and no-overlap constraints under the names the planner gives them, cut to 63 characters", async () => {
        const policy = await build()

        expect(policy.declaredConstraintsOf(LEAD)).toEqual([
            { name: "phone_taken", pgName: "records_sales_lead_phone_taken", refusal: "phone_taken" },
            { name: LONG_NAME, pgName: `records_sales_lead_${LONG_NAME}`.slice(0, 63), refusal: "slot_taken" },
        ])
    })

    it("lists nothing for an entity that declares no constraint", async () => {
        const policy = await build()
        const { constraints: _constraints, ...bare } = LEAD

        expect(policy.declaredConstraintsOf(bare)).toEqual([])
    })
})

describe("pgFailureOf", () => {
    const declared = [{ name: "phone_taken", pgName: "records_sales_lead_phone_taken", refusal: "phone_taken" }]

    it.each(["23505", "23P01"])(
        "answers taken with the declared refusal for %s on a declared constraint",
        async (code) => {
            const policy = await build()

            expect(policy.pgFailureOf({ code, constraint: "records_sales_lead_phone_taken" }, declared)).toEqual({
                kind: "taken",
                constraint: "phone_taken",
                refusal: "phone_taken",
            })
        },
    )

    it("reads the code and constraint from the driver error typeorm wraps", async () => {
        const policy = await build()
        const cause = {
            message: "duplicate",
            driverError: { code: "23505", constraint: "records_sales_lead_phone_taken" },
        }

        expect(policy.pgFailureOf(cause, declared)).toEqual({
            kind: "taken",
            constraint: "phone_taken",
            refusal: "phone_taken",
        })
    })

    it("reads the code and constraint from the error itself when the driver error does not carry them", async () => {
        const policy = await build()
        const cause = { code: "23505", constraint: "records_sales_lead_phone_taken", driverError: {} }

        expect(policy.pgFailureOf(cause, declared)).toEqual({
            kind: "taken",
            constraint: "phone_taken",
            refusal: "phone_taken",
        })
    })

    it("answers undeclared with the constraint name for a unique violation no declaration lists", async () => {
        const policy = await build()

        expect(policy.pgFailureOf({ code: "23505", constraint: "records_sales_lead_other" }, declared)).toEqual({
            kind: "undeclared",
            constraint: "records_sales_lead_other",
        })
    })

    it("answers undeclared with an empty name when the error names no constraint", async () => {
        const policy = await build()

        expect(policy.pgFailureOf({ code: "23P01" }, declared)).toEqual({ kind: "undeclared", constraint: "" })
    })
})

describe("pgFailureOf failures that are not a taken constraint", () => {
    const declared = [{ name: "phone_taken", pgName: "records_sales_lead_phone_taken", refusal: "phone_taken" }]

    it.each(["23514", "23502", "22P02", "23503"])("answers invalid with the constraint for %s", async (code) => {
        const policy = await build()

        expect(policy.pgFailureOf({ code, constraint: "records_sales_lead_phone_short" }, declared)).toEqual({
            kind: "invalid",
            constraint: "records_sales_lead_phone_short",
        })
    })

    it("answers invalid without a constraint when the error names none", async () => {
        const policy = await build()

        expect(policy.pgFailureOf({ code: "22P02" }, declared)).toEqual({ kind: "invalid", constraint: null })
    })

    it("answers scope for 42501 (row-level security)", async () => {
        const policy = await build()

        expect(policy.pgFailureOf({ code: "42501" }, declared)).toEqual({ kind: "scope" })
    })

    it.each(["40001", "40P01", "53300", "ECONNRESET", "ETIMEDOUT", "08006", "57P01"])(
        "answers transient for %s",
        async (code) => {
            const policy = await build()

            expect(policy.pgFailureOf({ code }, declared)).toEqual({ kind: "transient" })
        },
    )

    it("answers unknown for any other code", async () => {
        const policy = await build()

        expect(policy.pgFailureOf({ code: "XX000" }, declared)).toEqual({ kind: "unknown" })
    })

    it.each([null, undefined, "boom", 42, {}, { code: 5 }])(
        "answers unknown for %p, which carries no code",
        async (cause) => {
            const policy = await build()

            expect(policy.pgFailureOf(cause, declared)).toEqual({ kind: "unknown" })
        },
    )
})
