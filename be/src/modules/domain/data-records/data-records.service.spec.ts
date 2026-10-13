import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { DataRecordsService } from "./data-records.service"

const build = async () => {
    const entityManager = mockEntityManager()
    const moduleRef = await Test.createTestingModule({
        providers: [DataRecordsService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return { service: moduleRef.get(DataRecordsService), entityManager }
}

describe("DataRecordsService", () => {
    describe("upsert", () => {
        it("upsert has its first case written", async () => {
            const { service } = await build()
            expect(service.upsert).toBeInstanceOf(Function)
        })
    })

    describe("countExisting", () => {
        it("countExisting has its first case written", async () => {
            const { service } = await build()
            expect(service.countExisting).toBeInstanceOf(Function)
        })
    })

    describe("count", () => {
        it("count has its first case written", async () => {
            const { service } = await build()
            expect(service.count).toBeInstanceOf(Function)
        })
    })
})
