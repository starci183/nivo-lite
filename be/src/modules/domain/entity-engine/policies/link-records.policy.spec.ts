import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { entityCatalogOf, WORKSPACE_ID } from "@tests/fixtures/builders/entity-engine-compiler.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { MetaShape } from "@tests/fixtures/builders/entity-engine-compiler.builder"
import { RecordLinkEntity } from "../persistence/entities"
import { EntityEngineErrorCode } from "../errors/entity-engine.error"
import { linkRecords, unlinkRecords } from "./link-records.policy"
import { mintScopedTx } from "./scoped-tx.policy"

const LINK_RECORDS: unique symbol = Symbol("entity-engine.link-records")

interface LinkRecordsPolicy {
    readonly linkRecords: typeof linkRecords
    readonly unlinkRecords: typeof unlinkRecords
}

const build = async (): Promise<LinkRecordsPolicy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: LINK_RECORDS, useFactory: (): LinkRecordsPolicy => ({ linkRecords, unlinkRecords }) }],
    }).compile()
    return moduleRef.get<LinkRecordsPolicy>(LINK_RECORDS)
}

const CATALOG = entityCatalogOf(mock<MetaShape>())

const FROM = { workspaceId: WORKSPACE_ID, fromEntity: "sales.lead", fromId: "r-1" }

describe("linkRecords", () => {
    it("replaces the one link of a toOne relation", async () => {
        const policy = await build()
        const em = mockEntityManager()
        const [remove, insert] = queueQueryBuilders(em, [{ execute: {} }, { execute: {} }])

        await policy.linkRecords(mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }), CATALOG, {
            entity: "sales.lead",
            id: "r-1",
            relation: "owner",
            toId: "m-1",
        })

        expect(remove?.callsOf("from")).toEqual([[RecordLinkEntity]])
        expect(remove?.callsOf("where")).toEqual([[{ ...FROM, relation: "owner" }]])
        expect(insert?.callsOf("into")).toEqual([[RecordLinkEntity]])
        expect(insert?.callsOf("values")).toEqual([
            [{ ...FROM, relation: "owner", toEntity: "sales.member", toId: "m-1" }],
        ])
        expect(insert?.callsOf("orIgnore")).toHaveLength(1)
    })

    it("adds a link to a toMany relation without touching the others", async () => {
        const policy = await build()
        const em = mockEntityManager()
        const [insert] = queueQueryBuilders(em, [{ execute: {} }])

        await policy.linkRecords(mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }), CATALOG, {
            entity: "sales.lead",
            id: "r-1",
            relation: "tasks",
            toId: "t-1",
        })

        expect(em.createQueryBuilder).toHaveBeenCalledTimes(1)
        expect(insert?.callsOf("values")).toEqual([
            [{ ...FROM, relation: "tasks", toEntity: "sales.task", toId: "t-1" }],
        ])
    })

    it("refuses a relation the entity does not declare", async () => {
        const policy = await build()
        const em = mockEntityManager()

        await expect(
            policy.linkRecords(mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }), CATALOG, {
                entity: "sales.lead",
                id: "r-1",
                relation: "ghost",
                toId: "x",
            }),
        ).rejects.toMatchObject({ code: EntityEngineErrorCode.RelationUnknown })
    })
})

describe("unlinkRecords", () => {
    it("removes the one link to the target", async () => {
        const policy = await build()
        const em = mockEntityManager()
        const [remove] = queueQueryBuilders(em, [{ execute: {} }])

        await policy.unlinkRecords(mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }), CATALOG, {
            entity: "sales.lead",
            id: "r-1",
            relation: "tasks",
            toId: "t-1",
        })

        expect(remove?.callsOf("where")).toEqual([
            [{ ...FROM, relation: "tasks", toEntity: "sales.task", toId: "t-1" }],
        ])
    })
})
