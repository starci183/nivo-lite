import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { entityCatalogOf, leadEntityOf, WORKSPACE_ID } from "@tests/fixtures/builders/entity-engine-compiler.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { MetaShape } from "@tests/fixtures/builders/entity-engine-compiler.builder"
import { RecordEntity } from "../persistence/entities"
import { lockedLookup } from "./locked-lookup.policy"
import { mintScopedTx } from "./scoped-tx.policy"

const LOCKED_LOOKUP: unique symbol = Symbol("entity-engine.locked-lookup")

interface LockedLookupPolicy {
    readonly lockedLookup: typeof lockedLookup
}

const build = async (): Promise<LockedLookupPolicy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: LOCKED_LOOKUP, useFactory: (): LockedLookupPolicy => ({ lockedLookup }) }],
    }).compile()
    return moduleRef.get<LockedLookupPolicy>(LOCKED_LOOKUP)
}

const SHAPE = mock<MetaShape>()
const CATALOG = entityCatalogOf(SHAPE)
const LEAD = leadEntityOf(SHAPE)

const HASH_SQL = 'SELECT * FROM "pg_catalog"."hashtextextended"($1, $2)'
const LOCK_SQL = 'SELECT * FROM "pg_catalog"."pg_advisory_xact_lock"($1)'

describe("lockedLookup", () => {
    it("takes the advisory lock of the key before it reads the record", async () => {
        const policy = await build()
        const AT = new Date("2026-11-05T10:00:00.000Z")
        const record = Object.assign(new RecordEntity(), {
            entity: "sales.lead",
            id: "r-1",
            workspaceId: WORKSPACE_ID,
            version: "1",
            createdAt: AT,
            updatedAt: AT,
            data: { phone: "0900" },
        })
        const em = mockEntityManager({
            query: [
                [HASH_SQL, [{ hashtextextended: "123" }]],
                [LOCK_SQL, []],
            ],
        })
        queueQueryBuilders(em, [{ getOne: record }])

        const row = await policy.lockedLookup(
            mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }),
            CATALOG,
            LEAD,
            "byPhone",
            [["phone", "0900"]],
        )

        expect(row?.id).toBe("r-1")
        expect(em.query).toHaveBeenNthCalledWith(1, HASH_SQL, [
            JSON.stringify(["sales.lead", WORKSPACE_ID, "byPhone", [["phone", "0900"]]]),
            0,
        ])
        expect(em.query).toHaveBeenNthCalledWith(2, LOCK_SQL, ["123"])
    })

    it("reads nothing for a key with a null value, which never matches", async () => {
        const policy = await build()
        const em = mockEntityManager({
            query: [
                [HASH_SQL, [{ hashtextextended: "123" }]],
                [LOCK_SQL, []],
            ],
        })

        expect(
            await policy.lockedLookup(
                mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }),
                CATALOG,
                LEAD,
                "byPhone",
                [["phone", null]],
            ),
        ).toBeNull()
        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})
