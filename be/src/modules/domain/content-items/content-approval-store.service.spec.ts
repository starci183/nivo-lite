import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ContentApprovalStoreService } from "./content-approval-store.service"

const build = async () => {
    const entityManager = mockEntityManager()
    const moduleRef = await Test.createTestingModule({
        providers: [ContentApprovalStoreService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return { service: moduleRef.get(ContentApprovalStoreService), entityManager }
}

describe("ContentApprovalStoreService", () => {
    describe("claimSubmission", () => {
        it("claimSubmission has its first case written", async () => {
            const { service } = await build()
            expect(service.claimSubmission).toBeInstanceOf(Function)
        })
    })

    describe("approve", () => {
        it("approve has its first case written", async () => {
            const { service } = await build()
            expect(service.approve).toBeInstanceOf(Function)
        })
    })

    describe("reject", () => {
        it("reject has its first case written", async () => {
            const { service } = await build()
            expect(service.reject).toBeInstanceOf(Function)
        })
    })

    describe("markPublished", () => {
        it("markPublished has its first case written", async () => {
            const { service } = await build()
            expect(service.markPublished).toBeInstanceOf(Function)
        })
    })
})
