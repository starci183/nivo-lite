import { Test } from "@nestjs/testing"
import { entityCatalogOf } from "@tests/fixtures/builders/entity-engine-compiler.builder"
import { mock } from "@starci/jest-preset"
import type { MetaShape } from "@tests/fixtures/builders/entity-engine-compiler.builder"
import { entityOf, relationOf } from "./catalog-access.policy"
import { EntityEngineErrorCode } from "../errors/entity-engine.error"

const CATALOG_ACCESS: unique symbol = Symbol("entity-engine.catalog-access")

interface CatalogAccessPolicy {
    readonly entityOf: typeof entityOf
    readonly relationOf: typeof relationOf
}

const build = async (): Promise<CatalogAccessPolicy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: CATALOG_ACCESS, useFactory: (): CatalogAccessPolicy => ({ entityOf, relationOf }) }],
    }).compile()
    return moduleRef.get<CatalogAccessPolicy>(CATALOG_ACCESS)
}

const CATALOG = entityCatalogOf(mock<MetaShape>())

describe("entityOf", () => {
    it("answers the declaration of a catalog entity", async () => {
        const policy = await build()

        expect(policy.entityOf(CATALOG, "sales.lead").name).toBe("sales.lead")
    })

    it("refuses a name the catalog does not hold", async () => {
        const policy = await build()

        expect(() => policy.entityOf(CATALOG, "sales.ghost")).toThrow(EntityEngineErrorCode.EntityUnknown)
    })
})

describe("relationOf", () => {
    it("answers a relation the entity declares", async () => {
        const policy = await build()

        expect(policy.relationOf(policy.entityOf(CATALOG, "sales.lead"), "tasks")).toEqual({
            kind: "toMany",
            target: "sales.task",
        })
    })

    it("refuses a relation the entity does not declare", async () => {
        const policy = await build()

        expect(() => policy.relationOf(policy.entityOf(CATALOG, "sales.lead"), "ghost")).toThrow(
            EntityEngineErrorCode.RelationUnknown,
        )
    })

    it("refuses an inherited property name as a relation", async () => {
        const policy = await build()

        expect(() => policy.relationOf(policy.entityOf(CATALOG, "sales.lead"), "constructor")).toThrow(
            EntityEngineErrorCode.RelationUnknown,
        )
    })

    it("refuses any relation on an entity that declares none", async () => {
        const policy = await build()

        expect(() => policy.relationOf(policy.entityOf(CATALOG, "sales.member"), "owner")).toThrow(
            EntityEngineErrorCode.RelationUnknown,
        )
    })
})
