import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { DurableWorkService, EvidenceService } from "@modules/domain/decisions"
import type { WorkItem } from "@modules/domain/decisions"
import { PublicApiErrorCode } from "./errors/public-api.error"
import type { MessageRequestBody } from "./public-api.contracts"
import { SELECT_CONVERSATION } from "./persistence/public-api.sql"
import { PublicMessageFulfillmentService } from "./public-message-fulfillment.service"

const body: MessageRequestBody = {
    conversationId: "conversation-1",
    leadId: "stale-lead",
    text: "Exact caller text\nwith its original spacing.  ",
    requireApproval: false,
    source: "api:n8n",
}
const ctx = { workspaceId: "workspace-1", actor: "api:n8n", locale: "en" }

const build = async () => {
    const work = mock<DurableWorkService>({
        enqueueWork: jest.fn().mockResolvedValue(mock<WorkItem>({ id: "work-1" })),
    })
    const evidence = mock<EvidenceService>({ log: jest.fn().mockResolvedValue(undefined) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            PublicMessageFulfillmentService,
            { provide: DurableWorkService, useValue: work },
            { provide: EvidenceService, useValue: evidence },
        ],
    }).compile()
    return { service: moduleRef.get(PublicMessageFulfillmentService), work, evidence }
}

describe("PublicMessageFulfillmentService", () => {
    it("keeps the exact draft and its durable work and evidence in the supplied transaction", async () => {
        const tx = mockEntityManager({ query: [SELECT_CONVERSATION, [{ id: "conversation-1", lead_id: "lead-1" }]] })
        const { service, work, evidence } = await build()

        expect(await service.fulfill("workspace-1", "request-1", body, tx)).toBe("lead-1")

        expect(tx.query).toHaveBeenCalledWith(SELECT_CONVERSATION, ["workspace-1", "conversation-1"])
        expect(work.enqueueWork).toHaveBeenCalledWith(
            ctx,
            {
                action: "reply_customer",
                subject_type: "conversation",
                subject_id: "conversation-1",
                lead_id: "lead-1",
                dedupeKey: "api.message:request-1",
                seed: {
                    summary: "Public API message",
                    draft: body.text,
                    fields: { conversation_id: "conversation-1" },
                    confidence: 1,
                    outcome: "clear",
                },
                preset: true,
                noChain: true,
                forceAsk: undefined,
            },
            tx,
        )
        expect(evidence.log).toHaveBeenCalledWith(
            ctx,
            {
                lead_id: "lead-1",
                work_item_id: "work-1",
                kind: "api.message",
                actor: "api:n8n",
                summary: "Message accepted through the API",
                evidence: body.text,
            },
            tx,
        )
    })

    it("retains the legacy identity and approval without duplicating evidence already recorded at admission", async () => {
        const tx = mockEntityManager({ query: [SELECT_CONVERSATION, [{ id: "conversation-1", lead_id: null }]] })
        const { service, work, evidence } = await build()

        expect(
            await service.fulfill(
                "workspace-1",
                "request-1",
                { ...body, requireApproval: true },
                tx,
                "legacy-message",
                false,
            ),
        ).toBeNull()

        expect(work.enqueueWork).toHaveBeenCalledWith(
            ctx,
            expect.objectContaining({ dedupeKey: "legacy-message", lead_id: null, forceAsk: "over_authority" }),
            tx,
        )
        expect(evidence.log).not.toHaveBeenCalled()
    })
})

describe("PublicMessageFulfillmentService refusals", () => {
    it("refuses a conversation absent from the request workspace before inserting work or evidence", async () => {
        const tx = mockEntityManager({ query: [SELECT_CONVERSATION, []] })
        const { service, work, evidence } = await build()

        await expect(service.fulfill("workspace-1", "request-1", body, tx)).rejects.toMatchObject({
            code: PublicApiErrorCode.ConversationNotFound,
        })

        expect(work.enqueueWork).not.toHaveBeenCalled()
        expect(evidence.log).not.toHaveBeenCalled()
    })

    it("propagates a durable intake failure so the caller rolls back the request", async () => {
        const tx = mockEntityManager({ query: [SELECT_CONVERSATION, [{ id: "conversation-1", lead_id: "lead-1" }]] })
        const { service, work, evidence } = await build()
        const cause = new Error("durable intake unavailable")
        work.enqueueWork.mockRejectedValue(cause)

        await expect(service.fulfill("workspace-1", "request-1", body, tx)).rejects.toBe(cause)

        expect(evidence.log).not.toHaveBeenCalled()
    })
})
