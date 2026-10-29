import { Test } from "@nestjs/testing"
import { builder, fakeInbox, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { answerQueryBuilders, fakeQueryBuilder } from "@tests/fixtures/builders/fake-query-builder.builder"
import { PROCESSED_LEDGER_ROW, ledgerRowOf, ledgerRowOfKind } from "@tests/fixtures/builders/public-api-ledger.builder"
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
import { PublicApiEntity } from "./persistence/entities"
import { PublicApiLedgerService } from "./public-api-ledger.service"
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
/** A manager whose lock read finds the given ledger row (or none) and whose completion write is recorded. */
const managerWith = (row: PublicApiEntity | null) => {
    const tx = mockEntityManager({ findOne: [PublicApiEntity, row] })
    const complete = fakeQueryBuilder({ execute: {} })
    answerQueryBuilders(tx, complete)
    return { tx, complete }
}

/** Asserts that the request was completed with the given customer, once, under its workspace. */
const expectCompleted = (
    tx: ReturnType<typeof managerWith>["tx"],
    complete: ReturnType<typeof fakeQueryBuilder>,
    leadId: string | null,
): void => {
    expect(tx.createQueryBuilder).toHaveBeenCalledWith(PublicApiEntity, "p")
    expect(complete.callsOf("update")).toEqual([[]])
    expect(complete.argsOf("where")[0]?.[1]).toEqual({ workspaceId: WORKSPACE, requestId: REQUEST })
    expect(complete.argsOf("setParameter")).toEqual([["leadId", leadId]])
}
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
            PublicApiLedgerService,
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
        const { tx, complete } = managerWith(ledgerRowOf())
        const claims = mock<JobClaims>()
        const fence = mock<JobFenceService>()
        fence.write.mockImplementation((_job, action) => action(tx))
        const job = claimedJobOf()

        await built.service.processFenced(job, claims, fence)

        expect(claims.advance).toHaveBeenCalledWith({ jobId: "job-1", expectedFencingToken: 7, step: "public-api" })
        expect(fence.write).toHaveBeenCalledWith(job, expect.any(Function))
        expect(claims.advance.mock.invocationCallOrder[0]).toBeLessThan(fence.write.mock.invocationCallOrder[0] ?? 0)
        expectCompleted(tx, complete, null)
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
        const { tx, complete } = managerWith(ledgerRowOf({ leadId: LEAD }))

        await built.service.process(ledgerJob, tx)

        expect(tx.findOne).toHaveBeenCalledWith(PublicApiEntity, {
            where: { workspaceId: WORKSPACE, id: REQUEST },
            lock: { mode: "pessimistic_write" },
        })
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
        expectCompleted(tx, complete, LEAD)
        expect(built.manager.createQueryBuilder).not.toHaveBeenCalled()
        expect(built.manager.transaction).not.toHaveBeenCalled()
    })

    it("passes the persisted future need flag to the lead owner and stores its resolved customer", async () => {
        const built = await build()
        const { tx, complete } = managerWith(ledgerRowOfKind("lead", leadBody, true))

        await built.service.process(ledgerJob, tx)

        expect(built.leads.fulfill).toHaveBeenCalledWith(WORKSPACE, REQUEST, { ...leadBody, needSupplied: true }, tx)
        expectCompleted(tx, complete, LEAD)
    })

    it("hands off an admitted message with its admission time without performing a customer send", async () => {
        const built = await build()
        const body = { ...messageBody, leadId: null }
        const { tx, complete } = managerWith(ledgerRowOfKind("message", body))

        await built.service.process(ledgerJob, tx)

        expect(built.messages.fulfill).toHaveBeenCalledWith(WORKSPACE, REQUEST, body, ADMITTED_AT, tx)
        expectCompleted(tx, complete, LEAD)
    })
})

describe("PublicApiProcessingService / ledger replay and rollback", () => {
    it("rejects a workspace/request mismatch without claiming the inbox", async () => {
        const built = await build()

        await expect(built.service.process(ledgerJob, managerWith(null).tx)).rejects.toThrow(
            PublicApiErrorCode.RequestNotFound,
        )

        expect(built.inbox.claims).toEqual([])
    })

    it("acknowledges a completed request replay without any domain effect or new inbox claim", async () => {
        const built = await build()
        const { tx } = managerWith(PROCESSED_LEDGER_ROW)

        await built.service.process(ledgerJob, tx)

        expect(tx.findOne).toHaveBeenCalledTimes(1)
        expect(tx.createQueryBuilder).not.toHaveBeenCalled()
        expect(built.inbox.claims).toEqual([])
        expect(built.knowledge.addText).not.toHaveBeenCalled()
    })

    it("retains an inconsistent inbox receipt as a recoverable error instead of silently completing the ledger", async () => {
        const built = await build()
        const { tx } = managerWith(ledgerRowOf())
        built.inbox.seen(PUBLIC_API_QUEUE, `${WORKSPACE}:${REQUEST}`)

        await expect(built.service.process(ledgerJob, tx)).rejects.toThrow(PublicApiErrorCode.InboxInconsistent)

        expect(tx.findOne).toHaveBeenCalledTimes(1)
        expect(tx.createQueryBuilder).not.toHaveBeenCalled()
        expect(built.knowledge.addText).not.toHaveBeenCalled()
    })

    it("propagates owner failure so the enclosing fence transaction rolls back claim and effects", async () => {
        const built = await build()
        const tx = fakeTransaction(managerWith(ledgerRowOfKind("message", messageBody)).tx)
        built.messages.fulfill.mockRejectedValue(new Error("work insertion failed"))

        await expect(tx.em.transaction((manager) => built.service.process(ledgerJob, manager))).rejects.toThrow(
            "work insertion failed",
        )

        expect(tx.rollbacks).toBe(1)
        expect(tx.em.findOne).toHaveBeenCalledTimes(1)
        expect(tx.em.createQueryBuilder).not.toHaveBeenCalled()
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
        expect(tx.findOne).not.toHaveBeenCalled()
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
        const tx = fakeTransaction(managerWith(ledgerRowOf()).tx)
        const built = await build(tx.em)

        await built.service.failDelivery(deliveryOf())

        expect(tx.commits).toBe(1)
        expect(tx.em.findOne).toHaveBeenCalledWith(PublicApiEntity, {
            where: { workspaceId: WORKSPACE, id: REQUEST },
            lock: { mode: "pessimistic_write" },
        })
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

    it.each([{ row: null }, { row: PROCESSED_LEDGER_ROW }])(
        "does not mark a missing or already processed ledger as failed: %o",
        async ({ row }) => {
            const tx = fakeTransaction(managerWith(row).tx)
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

        expect(tx.em.findOne).not.toHaveBeenCalled()
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
