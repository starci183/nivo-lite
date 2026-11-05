import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { entityCatalogOf, WORKSPACE_ID } from "@tests/fixtures/builders/entity-engine-compiler.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { MetaShape } from "@tests/fixtures/builders/entity-engine-compiler.builder"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import { RecordEntity, RecordLinkEntity } from "../persistence/entities"
import { EntityEngineErrorCode } from "../errors/entity-engine.error"
import { deleteRecord } from "./delete-record.policy"
import { mintScopedTx } from "./scoped-tx.policy"

const DELETE_RECORD: unique symbol = Symbol("entity-engine.delete-record")

interface DeleteRecordPolicy {
    readonly deleteRecord: typeof deleteRecord
}

const build = async (): Promise<DeleteRecordPolicy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: DELETE_RECORD, useFactory: (): DeleteRecordPolicy => ({ deleteRecord }) }],
    }).compile()
    return moduleRef.get<DeleteRecordPolicy>(DELETE_RECORD)
}

const CALL: EntityDefinition = {
    entry: "entity",
    name: "sales.call",
    dataKind: "sales-call",
    fields: { title: { kind: "text", nullable: false, maxLength: 100 } },
    relations: { lead: { kind: "toOne", target: "sales.lead" } },
}

/** Leads, with two restrict relations pointing at them (tasks, calls) and one cascade relation (notes). */
const CATALOG = new Map<string, EntityDefinition>([...entityCatalogOf(mock<MetaShape>()), [CALL.name, CALL]])

describe("deleteRecord", () => {
    it("refuses the delete while a restrict relation still links to the record", async () => {
        const policy = await build()
        const em = mockEntityManager({ exists: [RecordLinkEntity, true] })

        const outcome = await policy.deleteRecord(
            mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }),
            CATALOG,
            "sales.lead",
            "r-1",
        )

        expect(outcome).toEqual({ kind: "blocked", relation: "lead" })
        expect(em.exists).toHaveBeenCalledTimes(1)
        expect(em.exists).toHaveBeenCalledWith(RecordLinkEntity, {
            where: {
                workspaceId: WORKSPACE_ID,
                fromEntity: "sales.task",
                relation: "lead",
                toEntity: "sales.lead",
                toId: "r-1",
            },
        })
    })
})

describe("deleteRecord (2)", () => {
    it("removes the links in both directions, then the record", async () => {
        const policy = await build()
        const em = mockEntityManager({ exists: [RecordLinkEntity, false] })
        const [incoming, outgoing, record] = queueQueryBuilders(em, [
            { execute: {} },
            { execute: {} },
            { execute: { raw: [{ id: "r-1" }] } },
        ])

        const outcome = await policy.deleteRecord(
            mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }),
            CATALOG,
            "sales.lead",
            "r-1",
        )

        expect(outcome).toEqual({ kind: "ok" })
        expect(em.exists).toHaveBeenCalledTimes(2)
        expect(incoming?.callsOf("from")).toEqual([[RecordLinkEntity]])
        expect(incoming?.callsOf("where")).toEqual([
            [{ workspaceId: WORKSPACE_ID, toEntity: "sales.lead", toId: "r-1" }],
        ])
        expect(outgoing?.callsOf("where")).toEqual([
            [{ workspaceId: WORKSPACE_ID, fromEntity: "sales.lead", fromId: "r-1" }],
        ])
        expect(record?.callsOf("from")).toEqual([[RecordEntity]])
        expect(record?.callsOf("where")).toEqual([[{ entity: "sales.lead", id: "r-1", workspaceId: WORKSPACE_ID }]])
        expect(record?.callsOf("returning")).toEqual([["id"]])
    })
})

describe("deleteRecord (3)", () => {
    it("answers missing when the workspace has no such record", async () => {
        const policy = await build()
        const em = mockEntityManager({ exists: [RecordLinkEntity, false] })
        queueQueryBuilders(em, [{ execute: {} }, { execute: {} }, { execute: { raw: [] } }])

        expect(
            await policy.deleteRecord(
                mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }),
                CATALOG,
                "sales.lead",
                "r-9",
            ),
        ).toEqual({
            kind: "missing",
        })
    })
})

describe("deleteRecord (4)", () => {
    it("refuses an entity that does not declare deletable records", async () => {
        const policy = await build()
        const em = mockEntityManager()

        await expect(
            policy.deleteRecord(
                mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }),
                CATALOG,
                "sales.member",
                "m-1",
            ),
        ).rejects.toMatchObject({ code: EntityEngineErrorCode.NotDeletable })
    })
})
