import { Test } from "@nestjs/testing"
import { DatabaseErrorCode } from "@modules/platform/database"
import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { RecordEntity } from "../persistence/entities"
import { EntityEngineErrorCode } from "../errors/entity-engine.error"
import {
    onlyRecord,
    pickFields,
    projectRecord,
    recordRowOfEntity,
    recordRowsOf,
    recordSelection,
} from "./record-row.policy"

const RECORD_ROW: unique symbol = Symbol("entity-engine.record-row")

interface RecordRowPolicy {
    readonly onlyRecord: typeof onlyRecord
    readonly pickFields: typeof pickFields
    readonly projectRecord: typeof projectRecord
    readonly recordRowOfEntity: typeof recordRowOfEntity
    readonly recordRowsOf: typeof recordRowsOf
    readonly recordSelection: typeof recordSelection
}

const build = async (): Promise<RecordRowPolicy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: RECORD_ROW,
                useFactory: (): RecordRowPolicy => ({
                    onlyRecord,
                    pickFields,
                    projectRecord,
                    recordRowOfEntity,
                    recordRowsOf,
                    recordSelection,
                }),
            },
        ],
    }).compile()
    return moduleRef.get<RecordRowPolicy>(RECORD_ROW)
}

const CREATED = new Date("2026-11-05T10:00:00.000Z")
const UPDATED = new Date("2026-11-05T11:00:00.000Z")

const RECORD: RecordRow = {
    id: "r-1",
    workspaceId: "ws-1",
    version: "3",
    createdAt: CREATED.toISOString(),
    updatedAt: UPDATED.toISOString(),
    data: { contactName: "An", phone: "0900" },
}

const returnedColumns = (data: unknown): Record<string, unknown> => ({
    id: "r-1",
    workspace_id: "ws-1",
    version: "3",
    created_at: CREATED,
    updated_at: UPDATED,
    data,
})

describe("recordSelection", () => {
    it("selects the six record columns of the alias under the names a RETURNING clause uses", async () => {
        const policy = await build()

        expect(policy.recordSelection("t")).toEqual([
            ["t.id", "id"],
            ["t.workspaceId", "workspace_id"],
            ["t.version", "version"],
            ["t.createdAt", "created_at"],
            ["t.updatedAt", "updated_at"],
            ["t.data", "data"],
        ])
    })
})

describe("recordRowOfEntity", () => {
    it("maps a loaded record to the engine row with ISO times", async () => {
        const policy = await build()
        const record = Object.assign(new RecordEntity(), {
            entity: "sales.lead",
            id: "r-1",
            workspaceId: "ws-1",
            version: "3",
            createdAt: CREATED,
            updatedAt: UPDATED,
            data: { contactName: "An", phone: "0900" },
        })

        expect(policy.recordRowOfEntity(record)).toEqual(RECORD)
    })
})

describe("recordRowsOf", () => {
    it("reads each returned row into an engine row", async () => {
        const policy = await build()

        expect(policy.recordRowsOf([returnedColumns({ contactName: "An", phone: "0900" })])).toEqual([RECORD])
    })

    it("refuses a row whose data is not an object", async () => {
        const policy = await build()

        expect(() => policy.recordRowsOf([returnedColumns("text")])).toThrow(EntityEngineErrorCode.ValueInvalid)
    })

    it("refuses an answer that is not a list of rows of the returned shape", async () => {
        const policy = await build()

        expect(() => policy.recordRowsOf({ rows: [] })).toThrow(DatabaseErrorCode.ReturningRowRejected)
        expect(() => policy.recordRowsOf([{ id: "r-1" }])).toThrow(DatabaseErrorCode.ReturningRowRejected)
    })
})

describe("onlyRecord", () => {
    it("answers the first row", async () => {
        const policy = await build()

        expect(policy.onlyRecord([RECORD])).toBe(RECORD)
    })

    it("refuses an answer without a row", async () => {
        const policy = await build()

        expect(() => policy.onlyRecord([])).toThrow(EntityEngineErrorCode.ResultMissing)
    })
})

describe("pickFields and projectRecord", () => {
    it("keeps the selected fields the data holds and drops the rest", async () => {
        const policy = await build()

        expect(policy.pickFields({ a: 1, b: 2 }, ["b", "c"])).toEqual({ b: 2 })
        expect(policy.projectRecord(RECORD, ["phone"])).toEqual({ ...RECORD, data: { phone: "0900" } })
    })
})
