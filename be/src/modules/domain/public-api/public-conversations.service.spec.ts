import { Test } from "@nestjs/testing"
import { mockEntityManager } from "@starci/jest-preset"
import { answerQueryBuilders, fakeQueryBuilder } from "@tests/fixtures/builders/fake-query-builder.builder"
import { PublicConversationsService } from "./public-conversations.service"

const CONVERSATION = { id: "conv-1", lead_id: "lead-1" }

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [PublicConversationsService] }).compile()
    return moduleRef.get(PublicConversationsService)
}

describe("PublicConversationsService", () => {
    it("finds a customer conversation of the workspace by id", async () => {
        const em = mockEntityManager()
        const read = fakeQueryBuilder({ getRawOne: CONVERSATION })
        answerQueryBuilders(em, read)

        await expect((await build()).find("ws-1", "conv-1", em)).resolves.toEqual(CONVERSATION)

        expect(read.argsOf("from")).toEqual([["public.agent_conversations", "c"]])
        expect(read.argsOf("where")).toEqual([
            [
                "c.workspace_id = :workspaceId AND c.kind = 'customer' AND c.id = :conversationId",
                { workspaceId: "ws-1", conversationId: "conv-1" },
            ],
        ])
        expect(read.argsOf("limit")).toEqual([[1]])
    })

    it("answers nothing for a conversation that is not there", async () => {
        const em = mockEntityManager()
        answerQueryBuilders(em, fakeQueryBuilder({ getRawOne: undefined }))

        await expect((await build()).find("ws-1", "missing", em)).resolves.toBeUndefined()
    })

    it("finds the latest customer conversation of a customer", async () => {
        const em = mockEntityManager()
        const read = fakeQueryBuilder({ getRawOne: CONVERSATION })
        answerQueryBuilders(em, read)

        await expect((await build()).ofLead("ws-1", "lead-1", em)).resolves.toEqual(CONVERSATION)

        expect(read.argsOf("where")).toEqual([
            [
                "c.workspace_id = :workspaceId AND c.kind = 'customer' AND c.lead_id = :leadId",
                { workspaceId: "ws-1", leadId: "lead-1" },
            ],
        ])
        expect(read.argsOf("orderBy")).toEqual([["c.created_at", "DESC"]])
    })
})
