import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import { answerQueryBuilders, fakeQueryBuilder } from "@tests/fixtures/builders/fake-query-builder.builder"
import { DurableWorkService, EvidenceService } from "@modules/domain/decisions"
import type { WorkItem } from "@modules/domain/decisions"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { PublicApiErrorCode } from "./errors/public-api.error"
import type { MessageRequestBody } from "./public-api.contracts"
import { PublicApiLogEvent } from "./public-api.log-events"
import { MESSAGE_AUTO_SEND_WINDOW_MS } from "./public-api.policy"
import { PublicConversationsService } from "./public-conversations.service"
import type { ConversationRef } from "./public-conversations.service"
import { PublicMessageFulfillmentService } from "./public-message-fulfillment.service"

const body: MessageRequestBody = {
    conversationId: "conversation-1",
    leadId: "stale-lead",
    text: "Exact caller text\nwith its original spacing.  ",
    requireApproval: false,
    source: "api:n8n",
}
const ctx = { workspaceId: "workspace-1", actor: "api:n8n", locale: "en" }
const NOW = new Date("2026-10-25T12:00:00.000Z")
const RECENT = new Date("2026-10-25T11:00:00.000Z")
const CONVERSATION = { id: "conversation-1", lead_id: "lead-1" }

/** A manager whose conversation read answers the given conversation, or none. */
const managerWith = (conversation: ConversationRef | undefined) => {
    const tx = mockEntityManager()
    const read = fakeQueryBuilder({ getRawOne: conversation })
    answerQueryBuilders(tx, read)
    return { tx, read }
}

const build = async () => {
    const work = mock<DurableWorkService>({
        enqueueWork: jest.fn().mockResolvedValue(mock<WorkItem>({ id: "work-1" })),
    })
    const evidence = mock<EvidenceService>({ log: jest.fn().mockResolvedValue(undefined) })
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            PublicMessageFulfillmentService,
            { provide: DurableWorkService, useValue: work },
            { provide: EvidenceService, useValue: evidence },
            PublicConversationsService,
            { provide: CLOCK, useValue: new FakeClock(NOW.toISOString()) },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(PublicMessageFulfillmentService), work, evidence, logger }
}

describe("PublicMessageFulfillmentService", () => {
    it("keeps the exact draft and its durable work and evidence in the supplied transaction", async () => {
        const { tx, read } = managerWith(CONVERSATION)
        const { service, work, evidence, logger } = await build()

        expect(await service.fulfill("workspace-1", "request-1", body, RECENT, tx)).toBe("lead-1")

        expect(read.argsOf("from")).toEqual([["public.agent_conversations", "c"]])
        expect(read.argsOf("where")).toEqual([
            [
                "c.workspace_id = :workspaceId AND c.kind = 'customer' AND c.id = :conversationId",
                { workspaceId: "workspace-1", conversationId: "conversation-1" },
            ],
        ])
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
        expect(logger.info).not.toHaveBeenCalled()
    })

    it("retains the legacy identity and approval without duplicating evidence already recorded at admission", async () => {
        const { tx } = managerWith({ ...CONVERSATION, lead_id: null })
        const { service, work, evidence } = await build()

        expect(
            await service.fulfill(
                "workspace-1",
                "request-1",
                { ...body, requireApproval: true },
                RECENT,
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

describe("PublicMessageFulfillmentService auto-send window", () => {
    it("still lets a message admitted exactly one window ago go out under the workspace's authority", async () => {
        const { tx } = managerWith(CONVERSATION)
        const { service, work, logger } = await build()
        const admittedAt = new Date(NOW.getTime() - MESSAGE_AUTO_SEND_WINDOW_MS)

        await service.fulfill("workspace-1", "request-1", body, admittedAt, tx)

        expect(work.enqueueWork).toHaveBeenCalledWith(ctx, expect.objectContaining({ forceAsk: undefined }), tx)
        expect(logger.info).not.toHaveBeenCalled()
    })

    it("holds an older message for approval with its draft kept and logs it without the content", async () => {
        const { tx } = managerWith(CONVERSATION)
        const { service, work, evidence, logger } = await build()
        const admittedAt = new Date(NOW.getTime() - MESSAGE_AUTO_SEND_WINDOW_MS - 1)

        await service.fulfill("workspace-1", "request-1", body, admittedAt, tx)

        expect(work.enqueueWork.mock.calls[0]?.[1]).toMatchObject({
            forceAsk: "over_authority",
            preset: true,
            seed: { draft: body.text },
        })
        expect(logger.info).toHaveBeenCalledWith(PublicApiLogEvent.StaleMessageHeld, {
            workspaceId: "workspace-1",
            requestId: "request-1",
            workItemId: "work-1",
            admittedAt: "2026-10-24T11:59:59.999Z",
        })
        expect(evidence.log).toHaveBeenCalledTimes(1)
    })

    it("holds a pre-ledger delivery, whose admission time is unknown, even when the caller asked for no approval", async () => {
        const { tx } = managerWith(CONVERSATION)
        const { service, work, logger } = await build()

        await service.fulfill("workspace-1", "legacy-1", body, null, tx, "legacy-1", false)

        expect(work.enqueueWork).toHaveBeenCalledWith(
            ctx,
            expect.objectContaining({ dedupeKey: "legacy-1", forceAsk: "over_authority" }),
            tx,
        )
        expect(logger.info).toHaveBeenCalledWith(PublicApiLogEvent.StaleMessageHeld, {
            workspaceId: "workspace-1",
            requestId: "legacy-1",
            workItemId: "work-1",
            admittedAt: null,
        })
    })
})

describe("PublicMessageFulfillmentService refusals", () => {
    it("refuses a conversation absent from the request workspace before inserting work or evidence", async () => {
        const { tx } = managerWith(undefined)
        const { service, work, evidence } = await build()

        await expect(service.fulfill("workspace-1", "request-1", body, RECENT, tx)).rejects.toMatchObject({
            code: PublicApiErrorCode.ConversationNotFound,
        })

        expect(work.enqueueWork).not.toHaveBeenCalled()
        expect(evidence.log).not.toHaveBeenCalled()
    })

    it("propagates a durable intake failure so the caller rolls back the request", async () => {
        const { tx } = managerWith(CONVERSATION)
        const { service, work, evidence, logger } = await build()
        const cause = new Error("durable intake unavailable")
        work.enqueueWork.mockRejectedValue(cause)

        await expect(service.fulfill("workspace-1", "request-1", body, null, tx)).rejects.toBe(cause)

        expect(evidence.log).not.toHaveBeenCalled()
        expect(logger.info).not.toHaveBeenCalled()
    })
})
