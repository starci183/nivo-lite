import { Test } from "@nestjs/testing"
import { leadEntityOf } from "@tests/fixtures/builders/entity-engine-compiler.builder"
import { mock } from "@starci/jest-preset"
import type { MetaShape } from "@tests/fixtures/builders/entity-engine-compiler.builder"
import { EntityEngineErrorCode } from "../errors/entity-engine.error"
import { fieldExpression } from "./field-access.policy"
import { paramBag } from "./param-bag.policy"

const FIELD_ACCESS: unique symbol = Symbol("entity-engine.field-access")

interface FieldAccessPolicy {
    readonly fieldExpression: typeof fieldExpression
}

const build = async (): Promise<FieldAccessPolicy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: FIELD_ACCESS, useFactory: (): FieldAccessPolicy => ({ fieldExpression }) }],
    }).compile()
    return moduleRef.get<FieldAccessPolicy>(FIELD_ACCESS)
}

const LEAD = leadEntityOf(mock<MetaShape>())

const KEY_OF_FIELD = "CAST(:p0 AS text)"

describe("fieldExpression", () => {
    it.each(["id", "workspaceId", "version", "createdAt", "updatedAt"])(
        "reads the system field %s as a column",
        async (name) => {
            const policy = await build()
            const params = paramBag("p")

            expect(policy.fieldExpression(LEAD, name, "r", params)).toBe(`r.${name}`)
            expect(params.values()).toEqual({})
        },
    )

    it.each([
        ["contactName", null],
        ["stage", null],
        ["code", null],
        ["meta", null],
        ["ownerRef", "uuid"],
        ["amount", "integer"],
        ["total", "bigint"],
        ["price", "bigint"],
        ["paid", "boolean"],
        ["closedAt", "timestamptz"],
        ["dueOn", "date"],
    ])("reads the declared field %s out of data with the cast %s", async (name, cast) => {
        const policy = await build()
        const params = paramBag("p")
        const text = `r.data ->> ${KEY_OF_FIELD}`

        expect(policy.fieldExpression(LEAD, name, "r", params)).toBe(cast === null ? text : `CAST(${text} AS ${cast})`)
        expect(params.values()).toEqual({ p0: name })
    })

    it("reads a declared nested key of a jsonb field with the key's cast", async () => {
        const policy = await build()
        const params = paramBag("p")

        expect(policy.fieldExpression(LEAD, "meta.score", "t", params)).toBe(
            "CAST(t.data -> CAST(:p0 AS text) ->> CAST(:p1 AS text) AS integer)",
        )
        expect(params.values()).toEqual({ p0: "meta", p1: "score" })
    })

    it("leaves a nested text key uncast", async () => {
        const policy = await build()

        expect(policy.fieldExpression(LEAD, "meta.label", "r", paramBag("p"))).toBe(
            "r.data -> CAST(:p0 AS text) ->> CAST(:p1 AS text)",
        )
    })

    it.each([
        "ghost",
        "constructor",
        "contactName.score",
        "bare.score",
        "meta.ghost",
        "meta.constructor",
        "ghost.score",
    ])("refuses the name %s", async (name) => {
        const policy = await build()

        expect(() => policy.fieldExpression(LEAD, name, "r", paramBag("p"))).toThrow(EntityEngineErrorCode.FieldUnknown)
    })
})
