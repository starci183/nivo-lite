import { Test } from "@nestjs/testing"
import { builder, fakeInbox, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { EventsService } from "@modules/domain/events"
import { ApiKnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { DomainError } from "@modules/platform/errors"
import { INBOX } from "@modules/platform/inbox"
import type { Inbox } from "@modules/platform/inbox"
import type { ClaimedJob, JobClaims, JobFenceService } from "@modules/platform/jobs"
import type { QueueDelivery } from "@modules/platform/queue"
import { PublicApiQueueJob, PUBLIC_API_QUEUE } from "@modules/queues/public-api"
import { PublicApiError, PublicApiErrorCode } from "./errors/public-api.error"
import { PublicApiProcessingService } from "./public-api-processing.service"
import type { PublicApiProcessingRow } from "./persistence/public-api-processing.rows"
import { COMPLETE_PUBLIC_API_REQUEST, LOCK_PUBLIC_API_REQUEST } from "./persistence/public-api-processing.sql"
import { PublicLeadFulfillmentService } from "./public-lead-fulfillment.service"
import { PublicMessageFulfillmentService } from "./public-message-fulfillment.service"

const WORKSPACE = "11111111-1111-4111-8111-111111111111"
const REQUEST = "22222222-2222-4222-8222-222222222222"
const LEAD = "33333333-3333-4333-8333-333333333333"
const CONVERSATION = "44444444-4444-4444-8444-444444444444"
const INBOUND = "55555555-5555-4555-8555-555555555555"
const source = "api:CRM"
const ledgerJob = { workspaceId: WORKSPACE, requestId: REQUEST }
const knowledgeBody = {
    title: "Guide",
    content: "Answer",
    topic: null,
    tags: ["sales"],
    visibility: "internal",
    source,
}
const leadBody = {
    name: "Lan",
    contact: "lan@example.test",
    need: "Created through the API",
    channel: "API",
    company: "ACME",
    note: "VIP",
    stage: null,
    externalId: "crm-1",
    source,
}
const messageBody = {
    conversationId: CONVERSATION,
    leadId: LEAD,
    text: "Exact caller draft",
    requireApproval: true,
    source,
}
const ADMITTED_AT = new Date("2026-10-24T08:00:00Z")
const rowOf = builder<PublicApiProcessingRow>({
    id: REQUEST,
    kind: "knowledge",
    payload: knowledgeBody,
    need_supplied: null,
    lead_id: null,
    processed_at: null,
    created_at: ADMITTED_AT,
})
const deliveryOf = builder<QueueDelivery>({
    id: "outbox-1",
    queue: PUBLIC_API_QUEUE,
    job: PublicApiQueueJob.Request,
    payload: ledgerJob,
    attempt: 4,
    signal: new AbortController().signal,
})

const build = async (manager: MockEntityManager = mockEntityManager()) => {
    const inbox = fakeInbox()
    const inboxPort: Inbox = inbox
    const claim = jest.spyOn(inboxPort, "claim")
    const knowledge = mock<ApiKnowledgeSourcesService>({
        addText: jest.fn().mockResolvedValue(undefined),
        indexExisting: jest.fn().mockResolvedValue(undefined),
    })
    const leads = mock<PublicLeadFulfillmentService>({
        fulfill: jest.fn().mockResolvedValue(LEAD),
        fulfillExistingInbound: jest.fn().mockResolvedValue(undefined),
    })
    const messages = mock<PublicMessageFulfillmentService>({ fulfill: jest.fn().mockResolvedValue(LEAD) })
    const events = mock<EventsService>({ record: jest.fn().mockResolvedValue(undefined) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            PublicApiProcessingService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: manager },
            { provide: INBOX, useValue: inbox },
            { provide: ApiKnowledgeSourcesService, useValue: knowledge },
            { provide: PublicLeadFulfillmentService, useValue: leads },
            { provide: PublicMessageFulfillmentService, useValue: messages },
            { provide: EventsService, useValue: events },
        ],
    }).compile()
    return {
        service: moduleRef.get(PublicApiProcessingService),
        manager,
        inbox,
        claim,
        knowledge,
        leads,
        messages,
        events,
    }
}

class PayloadAccessError extends DomainError<"PUBLIC_API_PAYLOAD_ACCESS"> {}

const claimedJobOf = builder<ClaimedJob>({
    jobId: "job-1",
    kind: PublicApiQueueJob.Request,
    fencingToken: 7,
    currentStep: null,
    payload: ledgerJob,
})

describe("PublicApiProcessingService / fenced execution", () => {
    it("advances the current token before fulfilling inside the supplied fence transaction", async () => {
        const built = await build()
        const tx = mockEntityManager({
            query: [
                [LOCK_PUBLIC_API_REQUEST, [rowOf()]],
                [COMPLETE_PUBLIC_API_REQUEST, []],
            ],
        })
        const claims = mock<JobClaims>()
        const fence = mock<JobFenceService>()
        fence.write.mockImplementation((_job, action) => action(tx))
        const job = claimedJobOf()

        await built.service.processFenced(job, claims, fence)

        expect(claims.advance).toHaveBeenCalledWith({ jobId: "job-1", expectedFencingToken: 7, step: "public-api" })
        expect(fence.write).toHaveBeenCalledWith(job, expect.any(Function))
        expect(claims.advance.mock.invocationCallOrder[0]).toBeLessThan(fence.write.mock.invocationCallOrder[0] ?? 0)
        expect(tx.query).toHaveBeenLastCalledWith(COMPLETE_PUBLIC_API_REQUEST, [WORKSPACE, REQUEST, null])
    })

    it("rejects an unsupported name before advancing or entering the fence", async () => {
        const built = await build()
        const claims = mock<JobClaims>()
        const fence = mock<JobFenceService>()

        await expect(built.service.processFenced(claimedJobOf({ kind: "unsupported" }), claims, fence)).rejects.toThrow(
            PublicApiErrorCode.RequestInvalid,
        )

        expect(claims.advance).not.toHaveBeenCalled()
        expect(fence.write).not.toHaveBeenCalled()
    })
})

describe("PublicApiProcessingService / ledger admissions", () => {
    it.each([PublicApiQueueJob.Request, PUBLIC_API_QUEUE])("accepts the supported job name %s", async (kind) => {
        expect((await build()).service.assertJobKind(kind)).toBeUndefined()
    })

    it("refuses an unsupported job before entering the fence", async () => {
        const built = await build()

        expect(() => built.service.assertJobKind("unsupported")).toThrow(PublicApiErrorCode.RequestInvalid)
    })

    it("creates the promised knowledge identity and completion inside the caller's transaction", async () => {
        const built = await build()
        const tx = mockEntityManager({
            query: [
                [LOCK_PUBLIC_API_REQUEST, [rowOf({ lead_id: LEAD })]],
                [COMPLETE_PUBLIC_API_REQUEST, []],
            ],
        })

        await built.service.process(ledgerJob, tx)

        expect(tx.query).toHaveBeenNthCalledWith(1, LOCK_PUBLIC_API_REQUEST, [WORKSPACE, REQUEST])
        expect(built.claim).toHaveBeenCalledWith(PUBLIC_API_QUEUE, `${WORKSPACE}:${REQUEST}`, tx)
        expect(built.knowledge.addText).toHaveBeenCalledWith(
            { sourceId: REQUEST, workspaceId: WORKSPACE, ...knowledgeBody, origin: source },
            tx,
        )
        expect(built.events.record).toHaveBeenCalledWith(
            {
                workspaceId: WORKSPACE,
                kind: "api.knowledge",
                actor: source,
                summary: "Knowledge accepted through the API",
                evidence: `source=${REQUEST} visibility=internal`,
            },
            tx,
        )
        expect(tx.query).toHaveBeenLastCalledWith(COMPLETE_PUBLIC_API_REQUEST, [WORKSPACE, REQUEST, LEAD])
        expect(built.manager.query).not.toHaveBeenCalled()
        expect(built.manager.transaction).not.toHaveBeenCalled()
    })

    it("passes the persisted future need flag to the lead owner and stores its resolved customer", async () => {
        const built = await build()
        const tx = mockEntityManager({
            query: [
                [LOCK_PUBLIC_API_REQUEST, [rowOf({ kind: "lead", payload: leadBody, need_supplied: true })]],
                [COMPLETE_PUBLIC_API_REQUEST, []],
            ],
        })

        await built.service.process(ledgerJob, tx)

        expect(built.leads.fulfill).toHaveBeenCalledWith(WORKSPACE, REQUEST, { ...leadBody, needSupplied: true }, tx)
        expect(tx.query).toHaveBeenLastCalledWith(COMPLETE_PUBLIC_API_REQUEST, [WORKSPACE, REQUEST, LEAD])
    })

    it("hands off an admitted message with its admission time without performing a customer send", async () => {
        const built = await build()
        const body = { ...messageBody, leadId: null }
        const tx = mockEntityManager({
            query: [
                [LOCK_PUBLIC_API_REQUEST, [rowOf({ kind: "message", payload: body })]],
                [COMPLETE_PUBLIC_API_REQUEST, []],
            ],
        })

        await built.service.process(ledgerJob, tx)

        expect(built.messages.fulfill).toHaveBeenCalledWith(WORKSPACE, REQUEST, body, ADMITTED_AT, tx)
        expect(tx.query).toHaveBeenLastCalledWith(COMPLETE_PUBLIC_API_REQUEST, [WORKSPACE, REQUEST, LEAD])
    })
})

describe("PublicApiProcessingService / ledger replay and rollback", () => {
    it("rejects a workspace/request mismatch without claiming the inbox", async () => {
        const built = await build()

        await expect(
            built.service.process(ledgerJob, mockEntityManager({ query: [LOCK_PUBLIC_API_REQUEST, []] })),
        ).rejects.toThrow(PublicApiErrorCode.RequestNotFound)

        expect(built.inbox.claims).toEqual([])
    })

    it("acknowledges a completed request replay without any domain effect or new inbox claim", async () => {
        const built = await build()
        const tx = mockEntityManager({
            query: [
                [LOCK_PUBLIC_API_REQUEST, [rowOf({ processed_at: new Date("2026-10-25T00:00:00Z") })]],
                [COMPLETE_PUBLIC_API_REQUEST, []],
            ],
        })

        await built.service.process(ledgerJob, tx)

        expect(tx.query).toHaveBeenCalledTimes(1)
        expect(built.inbox.claims).toEqual([])
        expect(built.knowledge.addText).not.toHaveBeenCalled()
    })

    it("retains an inconsistent inbox receipt as a recoverable error instead of silently completing the ledger", async () => {
        const built = await build()
        const tx = mockEntityManager({
            query: [
                [LOCK_PUBLIC_API_REQUEST, [rowOf()]],
                [COMPLETE_PUBLIC_API_REQUEST, []],
            ],
        })
        built.inbox.seen(PUBLIC_API_QUEUE, `${WORKSPACE}:${REQUEST}`)

        await expect(built.service.process(ledgerJob, tx)).rejects.toThrow(PublicApiErrorCode.InboxInconsistent)

        expect(tx.query).toHaveBeenCalledTimes(1)
        expect(built.knowledge.addText).not.toHaveBeenCalled()
    })

    it("propagates owner failure so the enclosing fence transaction rolls back claim and effects", async () => {
        const built = await build()
        const tx = fakeTransaction(
            mockEntityManager({
                query: [
                    [LOCK_PUBLIC_API_REQUEST, [rowOf({ kind: "message", payload: messageBody })]],
                    [COMPLETE_PUBLIC_API_REQUEST, []],
                ],
            }),
        )
        built.messages.fulfill.mockRejectedValue(new Error("work insertion failed"))

        await expect(tx.em.transaction((manager) => built.service.process(ledgerJob, manager))).rejects.toThrow(
            "work insertion failed",
        )

        expect(tx.rollbacks).toBe(1)
        expect(tx.em.query).toHaveBeenCalledTimes(1)
    })
})

describe("PublicApiProcessingService / pre-ledger deliveries", () => {
    it("indexes an existing historical source and preserves its identity", async () => {
        const built = await build()
        const tx = mockEntityManager()

        await built.service.process({ kind: "knowledge", workspaceId: WORKSPACE, sourceId: REQUEST }, tx)

        expect(built.claim).toHaveBeenCalledWith(PUBLIC_API_QUEUE, `${WORKSPACE}:knowledge:${REQUEST}`, tx)
        expect(built.knowledge.indexExisting).toHaveBeenCalledWith(WORKSPACE, REQUEST, tx)
        expect(built.knowledge.addText).not.toHaveBeenCalled()
    })

    it("hands off the original inbound identity instead of creating a new admission", async () => {
        const built = await build()
        const tx = mockEntityManager()
        const body = { inboundEventId: INBOUND, keyName: "CRM", company: "ACME", stage: null, note: "VIP" }

        await built.service.process({ kind: "lead", workspaceId: WORKSPACE, ...body }, tx)

        expect(built.leads.fulfillExistingInbound).toHaveBeenCalledWith(WORKSPACE, INBOUND, body, tx)
        expect(built.claim).toHaveBeenCalledWith(PUBLIC_API_QUEUE, `${WORKSPACE}:lead:${INBOUND}`, tx)
        expect(tx.query).not.toHaveBeenCalled()
    })

    it("retains the original message work dedupe and approval requirement, with no admission time", async () => {
        const built = await build()
        const tx = mockEntityManager()

        await built.service.process(
            { kind: "message", workspaceId: WORKSPACE, keyName: "CRM", dedupeKey: "old-message-1", ...messageBody },
            tx,
        )

        expect(built.messages.fulfill).toHaveBeenCalledWith(
            WORKSPACE,
            "old-message-1",
            messageBody,
            null,
            tx,
            "old-message-1",
            false,
        )
        expect(built.claim).toHaveBeenCalledWith(PUBLIC_API_QUEUE, `${WORKSPACE}:message:old-message-1`, tx)
    })

    it("acknowledges duplicate historical delivery without repeating its effect", async () => {
        const built = await build()
        built.inbox.seen(PUBLIC_API_QUEUE, `${WORKSPACE}:knowledge:${REQUEST}`)

        await built.service.process(
            { kind: "knowledge", workspaceId: WORKSPACE, sourceId: REQUEST },
            mockEntityManager(),
        )

        expect(built.knowledge.indexExisting).not.toHaveBeenCalled()
    })
})

describe("PublicApiProcessingService / terminal failure evidence", () => {
    it("records one exhausted request event inside its own transaction", async () => {
        const tx = fakeTransaction(mockEntityManager({ query: [LOCK_PUBLIC_API_REQUEST, [rowOf()]] }))
        const built = await build(tx.em)

        await built.service.failDelivery(deliveryOf())

        expect(tx.commits).toBe(1)
        expect(tx.em.query).toHaveBeenCalledWith(LOCK_PUBLIC_API_REQUEST, [WORKSPACE, REQUEST])
        expect(built.claim).toHaveBeenCalledWith("public_api.failed", "outbox-1", expect.anything())
        expect(built.events.record).toHaveBeenCalledWith(
            {
                workspaceId: WORKSPACE,
                kind: "api.failed",
                actor: "NIVO",
                summary: "Public API request exhausted its queue attempts; operator recovery is required",
                evidence: "outbox-1",
            },
            built.claim.mock.calls[0]?.[2],
        )
    })

    it.each([{ rows: [] }, { rows: [rowOf({ processed_at: new Date("2026-10-25T00:00:00Z") })] }])(
        "does not mark a missing or already processed ledger as failed: %o",
        async ({ rows }) => {
            const tx = fakeTransaction(mockEntityManager({ query: [LOCK_PUBLIC_API_REQUEST, rows] }))
            const built = await build(tx.em)

            await built.service.failDelivery(deliveryOf())

            expect(built.inbox.claims).toEqual([])
            expect(built.events.record).not.toHaveBeenCalled()
        },
    )

    it("deduplicates failure evidence for a historical delivery without looking up a ledger", async () => {
        const tx = fakeTransaction(mockEntityManager())
        const built = await build(tx.em)
        built.inbox.seen("public_api.failed", "outbox-1")

        await built.service.failDelivery(
            deliveryOf({ payload: { kind: "knowledge", workspaceId: WORKSPACE, sourceId: REQUEST } }),
        )

        expect(tx.em.query).not.toHaveBeenCalled()
        expect(built.events.record).not.toHaveBeenCalled()
    })

    it("leaves malformed delivery evidence to the standard failure archive without inventing a workspace", async () => {
        const built = await build()

        await built.service.failDelivery(deliveryOf({ payload: {} }))

        expect(built.manager.transaction).not.toHaveBeenCalled()
    })

    it.each([
        new PayloadAccessError({ code: "PUBLIC_API_PAYLOAD_ACCESS" }),
        new PublicApiError({ code: PublicApiErrorCode.NotWritten }),
    ])("propagates unexpected payload access failures: %o", async (failure) => {
        const built = await build()
        const payload = {
            get workspaceId(): string {
                throw failure
            },
        }

        await expect(built.service.failDelivery(deliveryOf({ payload }))).rejects.toBe(failure)

        expect(built.manager.transaction).not.toHaveBeenCalled()
    })
})
