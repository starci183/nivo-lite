import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { WORKSPACE_ID } from "@tests/fixtures/builders/entity-engine-compiler.builder"
import { RecordEntity } from "../persistence/entities"
import { getRecord } from "./get-record.policy"
import { mintScopedTx } from "./scoped-tx.policy"

const GET_RECORD: unique symbol = Symbol("entity-engine.get-record")

interface GetRecordPolicy {
    readonly getRecord: typeof getRecord
}

const build = async (): Promise<GetRecordPolicy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: GET_RECORD, useFactory: (): GetRecordPolicy => ({ getRecord }) }],
    }).compile()
    return moduleRef.get<GetRecordPolicy>(GET_RECORD)
}

describe("getRecord", () => {
    it("reads the record of the scope's workspace by entity and id", async () => {
        const policy = await build()
        const record = Object.assign(new RecordEntity(), {
            entity: "sales.lead",
            id: "r-1",
            workspaceId: WORKSPACE_ID,
            version: "2",
            createdAt: new Date("2026-11-05T10:00:00.000Z"),
            updatedAt: new Date("2026-11-05T11:00:00.000Z"),
            data: { contactName: "An" },
        })
        const em = mockEntityManager({ findOne: [RecordEntity, record] })

        const row = await policy.getRecord(
            mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }),
            "sales.lead",
            "r-1",
        )

        expect(row).toEqual({
            id: "r-1",
            workspaceId: WORKSPACE_ID,
            version: "2",
            createdAt: "2026-11-05T10:00:00.000Z",
            updatedAt: "2026-11-05T11:00:00.000Z",
            data: { contactName: "An" },
        })
        expect(em.findOne).toHaveBeenCalledWith(RecordEntity, {
            where: { entity: "sales.lead", id: "r-1", workspaceId: WORKSPACE_ID },
        })
    })

    it("answers null when the workspace holds no such record", async () => {
        const policy = await build()
        const em = mockEntityManager({ findOne: [RecordEntity, null] })

        expect(
            await policy.getRecord(mintScopedTx({ manager: em, workspaceId: WORKSPACE_ID }), "sales.lead", "r-9"),
        ).toBeNull()
    })
})
