import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { entityCatalogOf, leadEntityOf, WORKSPACE_ID } from "@tests/fixtures/builders/entity-engine-compiler.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { MetaShape } from "@tests/fixtures/builders/entity-engine-compiler.builder"
import { RecordEntity } from "../persistence/entities"
import { findRecordByFields } from "./find-by-fields.policy"
import { mintScopedTx } from "./scoped-tx.policy"

const FIND_BY_FIELDS: unique symbol = Symbol("entity-engine.find-by-fields")

interface FindByFieldsPolicy {
    readonly findRecordByFields: typeof findRecordByFields
}

const build = async (): Promise<FindByFieldsPolicy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: FIND_BY_FIELDS, useFactory: (): FindByFieldsPolicy => ({ findRecordByFields }) }],
    }).compile()
    return moduleRef.get<FindByFieldsPolicy>(FIND_BY_FIELDS)
}

const SHAPE = mock<MetaShape>()
const CATALOG = entityCatalogOf(SHAPE)
const LEAD = leadEntityOf(SHAPE)

describe("findRecordByFields", () => {
    it("reads the first record of the workspace whose fields equal the values", async () => {
        const policy = await build()
        const AT = new Date("2026-11-05T10:00:00.000Z")
        const record = Object.assign(new RecordEntity(), {
            entity: "sales.lead",
            id: "r-1",
            workspaceId: WORKSPACE_ID,
            version: "2",
            createdAt: AT,
            updatedAt: AT,
            data: { phone: "0900" },
        })
        const em = mockEntityManager()
        const [fake] = queueQueryBuilders(em, [{ getOne: record }])

        const row = await policy.findRecordByFields(
            mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }),
            CATALOG,
            LEAD,
            [["phone", "0900"]],
        )

        expect(row).toMatchObject({ id: "r-1", version: "2", data: { phone: "0900" } })
        expect(em.createQueryBuilder).toHaveBeenCalledWith(RecordEntity, "r")
        expect(fake?.callsOf("where")).toEqual([
            ["r.entity = :entity AND r.workspaceId = :ws", { entity: "sales.lead", ws: WORKSPACE_ID }],
        ])
        expect(fake?.callsOf("andWhere")).toEqual([["(r.data ->> CAST(:p0 AS text) = :p1)"]])
        expect(fake?.callsOf("setParameters")).toEqual([[{ p0: "phone", p1: "0900" }]])
        expect(fake?.callsOf("limit")).toEqual([[1]])
    })

    it("answers null when no record has the values", async () => {
        const policy = await build()
        const em = mockEntityManager()
        queueQueryBuilders(em, [{ getOne: null }])

        expect(
            await policy.findRecordByFields(mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }), CATALOG, LEAD, [
                ["phone", "0000"],
            ]),
        ).toBeNull()
    })
})
