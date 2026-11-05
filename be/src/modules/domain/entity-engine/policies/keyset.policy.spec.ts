import { Test } from "@nestjs/testing"
import { leadEntityOf } from "@tests/fixtures/builders/entity-engine-compiler.builder"
import { mock } from "@starci/jest-preset"
import type { MetaShape } from "@tests/fixtures/builders/entity-engine-compiler.builder"
import { EntityEngineErrorCode } from "../errors/entity-engine.error"
import { keysetFragment } from "./keyset.policy"
import { paramBag } from "./param-bag.policy"

const KEYSET: unique symbol = Symbol("entity-engine.keyset")

interface KeysetPolicy {
    readonly keysetFragment: typeof keysetFragment
}

const build = async (): Promise<KeysetPolicy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: KEYSET, useFactory: (): KeysetPolicy => ({ keysetFragment }) }],
    }).compile()
    return moduleRef.get<KeysetPolicy>(KEYSET)
}

const LEAD = leadEntityOf(mock<MetaShape>())
const AMOUNT = "CAST(r.data ->> CAST(:p0 AS text) AS integer)"

describe("keysetFragment", () => {
    it("keeps the rows after the position: after the first column, or equal to it and after the next", async () => {
        const policy = await build()
        const params = paramBag("p")

        expect(
            policy.keysetFragment(
                LEAD,
                [
                    ["amount", "asc"],
                    ["id", "desc"],
                ],
                ["5", "id-5"],
                "r",
                params,
            ),
        ).toBe(`(((${AMOUNT} > :p1 OR ${AMOUNT} IS NULL)) OR (${AMOUNT} = :p1 AND r.id < :p2))`)
        expect(params.values()).toEqual({ p0: "amount", p1: "5", p2: "id-5" })
    })

    it("sorts null last ascending and first descending", async () => {
        const policy = await build()

        expect(
            policy.keysetFragment(
                LEAD,
                [
                    ["amount", "desc"],
                    ["id", "asc"],
                ],
                [null, "id-5"],
                "r",
                paramBag("p"),
            ),
        ).toBe(`((${AMOUNT} IS NOT NULL) OR (${AMOUNT} IS NULL AND (r.id > :p1 OR r.id IS NULL)))`)
        expect(policy.keysetFragment(LEAD, [["amount", "asc"]], [null], "r", paramBag("p"))).toBe(`((FALSE))`)
    })

    it("refuses a position that does not match the order", async () => {
        const policy = await build()
        const order = [
            ["amount", "asc"],
            ["id", "asc"],
        ] as const

        expect(() => policy.keysetFragment(LEAD, order, ["5"], "r", paramBag("p"))).toThrow(
            EntityEngineErrorCode.PositionMismatch,
        )
        expect(() => policy.keysetFragment(LEAD, order, ["5", "a", "b"], "r", paramBag("p"))).toThrow(
            EntityEngineErrorCode.PositionMismatch,
        )
    })
})
