import { Test } from "@nestjs/testing"
import { isRecord } from "@modules/platform/primitives"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { entityCatalogOf, insertStampOf, WORKSPACE_ID } from "@tests/fixtures/builders/entity-engine-compiler.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { MetaShape } from "@tests/fixtures/builders/entity-engine-compiler.builder"
import type { EntityDefinition } from "@nivo-lite/agent-sdk/entity"
import { RecordEntity } from "../persistence/entities"
import { insertRecord } from "./insert-record.policy"
import { RECORD_RETURNING } from "./record-row.policy"
import { mintScopedTx } from "./scoped-tx.policy"

const INSERT_RECORD: unique symbol = Symbol("entity-engine.insert-record")

interface InsertRecordPolicy {
    readonly insertRecord: typeof insertRecord
}

const build = async (): Promise<InsertRecordPolicy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: INSERT_RECORD, useFactory: (): InsertRecordPolicy => ({ insertRecord }) }],
    }).compile()
    return moduleRef.get<InsertRecordPolicy>(INSERT_RECORD)
}

const ID = "00000000-0000-4000-8000-000000000099"
const AT = new Date("2026-11-05T10:00:00.000Z")

const returned = (data: Record<string, unknown>): Record<string, unknown> => ({
    id: ID,
    workspace_id: WORKSPACE_ID,
    version: "1",
    created_at: AT,
    updated_at: AT,
    data,
})

/** Matches the raw SQL expression a builder assignment carries. */
const ANY_FUNCTION: unknown = expect.any(Function)

describe("insertRecord", () => {
    it("writes the defaults, the given values and the formatted sequence values in one INSERT ... RETURNING", async () => {
        const policy = await build()
        const shape = mock<MetaShape>()
        shape.parse.mockImplementation((value) => ({ parsed: value }))
        const em = mockEntityManager()
        const data = {
            stage: "new",
            seenAt: "2026-11-05T10:00:00.000Z",
            token: "00000000-0000-4000-8000-000000000001",
            note: "",
            meta: { parsed: { a: 1 } },
            contactName: "An",
            code: "DH-{yyyy}-{n:5}#4",
            ticket: "T{n:4}#9",
        }
        const [codeInsert, codeUpdate, ticketInsert, ticketUpdate, insert] = queueQueryBuilders(em, [
            { execute: {} },
            { execute: { raw: [{ value: "4" }] } },
            { execute: {} },
            { execute: { raw: [{ value: "9" }] } },
            { execute: { raw: [returned(data)] } },
        ])

        const row = await policy.insertRecord(
            mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }),
            entityCatalogOf(shape),
            {
                entity: "sales.lead",
                id: ID,
                values: { contactName: "An", meta: { a: 1 } },
                stamp: insertStampOf(),
            },
        )

        expect(row).toEqual({
            id: ID,
            workspaceId: WORKSPACE_ID,
            version: "1",
            createdAt: AT.toISOString(),
            updatedAt: AT.toISOString(),
            data,
        })
        expect(codeInsert?.callsOf("values")).toEqual([
            [{ workspaceId: WORKSPACE_ID, entity: "sales.lead", field: "code", period: "2026" }],
        ])
        expect(codeUpdate?.callsOf("where")).toEqual([
            [{ workspaceId: WORKSPACE_ID, entity: "sales.lead", field: "code", period: "2026" }],
        ])
        expect(ticketInsert?.callsOf("values")).toEqual([
            [{ workspaceId: WORKSPACE_ID, entity: "sales.lead", field: "ticket", period: "" }],
        ])
        expect(ticketUpdate?.callsOf("returning")).toEqual([["value"]])
        expect(insert?.callsOf("into")).toEqual([[RecordEntity]])
        expect(insert?.callsOf("values")).toEqual([
            [{ id: ID, workspaceId: WORKSPACE_ID, entity: "sales.lead", data: ANY_FUNCTION }],
        ])
        expect(insert?.callsOf("setParameter")).toEqual([["data", JSON.stringify(data)]])
        const written = insert?.callsOf("values")[0]?.[0]
        const dataExpression = isRecord(written) ? written.data : undefined
        expect(typeof dataExpression === "function" ? Reflect.apply(dataExpression, undefined, []) : undefined).toBe(
            "CAST(:data AS jsonb)",
        )
        expect(insert?.callsOf("returning")).toEqual([[RECORD_RETURNING]])
    })
})

describe("insertRecord (2)", () => {
    it("formats a sequence field that declares no format as the bare counter", async () => {
        const policy = await build()
        const counter: EntityDefinition = {
            entry: "entity",
            name: "sales.counter",
            dataKind: "sales-counter",
            fields: { n: { kind: "sequence", nullable: false } },
        }
        const em = mockEntityManager()
        const [, , insert] = queueQueryBuilders(em, [
            { execute: {} },
            { execute: { raw: [{ value: "1" }] } },
            { execute: { raw: [returned({ n: "#1" })] } },
        ])

        const row = await policy.insertRecord(
            mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }),
            new Map([[counter.name, counter]]),
            {
                entity: "sales.counter",
                id: ID,
                values: {},
                stamp: insertStampOf(),
            },
        )

        expect(row.data).toEqual({ n: "#1" })
        expect(insert?.callsOf("values")).toEqual([
            [{ id: ID, workspaceId: WORKSPACE_ID, entity: "sales.counter", data: ANY_FUNCTION }],
        ])
        expect(insert?.callsOf("setParameter")).toEqual([["data", '{"n":"#1"}']])
    })
})
