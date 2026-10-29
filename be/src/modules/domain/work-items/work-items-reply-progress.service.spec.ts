import { Test } from "@nestjs/testing"
import { fakeQueryBuilder } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { WorkItemsReplyProgressService } from "./work-items-reply-progress.service"

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [WorkItemsReplyProgressService, { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager }],
    }).compile()
    return moduleRef.get(WorkItemsReplyProgressService)
}

/** A manager whose one query builder answers these terminals. */
const answering = (answers: QueryBuilderAnswers) => {
    const em = mockEntityManager()
    const fake = fakeQueryBuilder(answers)
    em.createQueryBuilder.mockReturnValue(fake.builder)
    return { em, fake }
}

describe("WorkItemsReplyProgressService > answerProgress", () => {
    it("answers how far the reply got and what was delivered", async () => {
        const row = { id: "w1", work_status: "done", message_id: "m1", delivery_status: "sent" }
        const { em, fake } = answering({ getRawOne: row })

        await expect((await build(em)).answerProgress("ws", "w1")).resolves.toEqual(row)
        expect(fake.callsOf("where")[0]?.[1]).toEqual({ workspaceId: "ws", workItemId: "w1" })
        expect(fake.callsOf("limit")).toEqual([[1]])
    })

    it("answers null when the workspace has no such reply", async () => {
        const { em } = answering({ getRawOne: undefined })

        await expect((await build(em)).answerProgress("ws", "ghost")).resolves.toBeNull()
    })
})
