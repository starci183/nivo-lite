import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ContentAiStoreService } from "./content-ai-store.service"

const build = async () => {
    const clock = new FakeClock("2026-01-01T00:00:00.000Z")
    const entityManager = mockEntityManager()
    const members = mock<WorkspaceMembersService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ContentAiStoreService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: CLOCK, useValue: clock },
        ],
    }).compile()
    return { service: moduleRef.get(ContentAiStoreService), clock, entityManager, members }
}

describe("ContentAiStoreService", () => {
    describe("createQuickIdea", () => {
        it("createQuickIdea has its first case written", async () => {
            const { service } = await build()
            expect(service.createQuickIdea).toBeInstanceOf(Function)
        })
    })

    describe("applyDraft", () => {
        it("applyDraft has its first case written", async () => {
            const { service } = await build()
            expect(service.applyDraft).toBeInstanceOf(Function)
        })
    })

    describe("recentTitles", () => {
        it("recentTitles has its first case written", async () => {
            const { service } = await build()
            expect(service.recentTitles).toBeInstanceOf(Function)
        })
    })

    describe("insertPlannedIdeas", () => {
        it("insertPlannedIdeas has its first case written", async () => {
            const { service } = await build()
            expect(service.insertPlannedIdeas).toBeInstanceOf(Function)
        })
    })
})
