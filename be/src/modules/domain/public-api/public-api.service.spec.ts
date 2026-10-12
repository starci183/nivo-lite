import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import type { MockEntityManager, RecordingQueueOutbox } from "@starci/jest-preset"
import type { ApiPrincipal } from "@modules/domain/api-keys"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import { PUBLIC_API_QUEUE, PublicApiQueue } from "@modules/queues/public-api"
import { PublicApiErrorCode } from "./errors/public-api.error"
import type { AcceptKnowledgeParams, AcceptLeadParams, AcceptMessageParams } from "./public-api.contracts"
import { PublicApiService } from "./public-api.service"
import {
    BUMP_INBOUND_DUPLICATE,
    INSERT_EVIDENCE,
    INSERT_INBOUND_LEAD,
    INSERT_KNOWLEDGE_SOURCE,
    LIST_EVENTS,
    LIST_LEADS,
    MATCH_LEAD_BY_EMAIL,
    MATCH_LEAD_BY_NAME,
    MATCH_LEAD_BY_PHONE,
    SELECT_CONVERSATION,
    SELECT_CONVERSATION_OF_LEAD,
} from "./persistence/public-api.sql"

const WHO: ApiPrincipal = { keyId: "key-1", workspaceId: "workspace-1", name: "n8n", scopes: [] }

const LEAD: AcceptLeadParams = {
    name: "Nguyen A",
    phone: "0912 000 701",
    email: "",
    company: "ACME",
    need: "price",
    channel: "Zalo",
    externalId: "crm-9",
    note: "vip",
    stage: "qualified",
}

const MESSAGE: AcceptMessageParams = {
    text: "hello",
    conversationId: "conv-1",
    leadId: "",
    requireApproval: true,
    idempotencyKey: "idem-1",
}

const KNOWLEDGE: AcceptKnowledgeParams = {
    title: "Prices",
    content: "A is 1",
    topic: "Price",
    visibility: "public",
    tags: [" a ", ""],
}

const build = async (entityManager: MockEntityManager) => {
    const outbox: RecordingQueueOutbox = recordingQueueOutbox()
    const moduleRef = await Test.createTestingModule({
        providers: [
            PublicApiService,
            PublicApiQueue,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock("2026-10-12T10:00:00.000Z") },
            { provide: QUEUE_OUTBOX, useValue: outbox },
        ],
    }).compile()
    return { service: moduleRef.get(PublicApiService), outbox }
}

describe("PublicApiService", () => {
    describe("listLeads", () => {
        it("lists the workspace's customers with the stage filter and the limit", async () => {
            const em = mockEntityManager({
                query: [
                    LIST_LEADS,
                    [
                        {
                            id: "lead-1",
                            contact_name: "A",
                            company: "ACME",
                            channel: "Zalo",
                            need: "price",
                            stage: "new",
                            phone: "84912000701",
                            email: null,
                            created_at: "2026-10-12T09:00:00.000Z",
                        },
                    ],
                ],
            })
            const { service } = await build(em)

            await expect(service.listLeads("workspace-1", "new", 50)).resolves.toEqual([
                {
                    id: "lead-1",
                    name: "A",
                    company: "ACME",
                    channel: "Zalo",
                    need: "price",
                    stage: "new",
                    phone: "84912000701",
                    email: null,
                    createdAt: "2026-10-12T09:00:00.000Z",
                },
            ])

            expect(em.query).toHaveBeenCalledWith(LIST_LEADS, ["workspace-1", "new", 50])
        })

        it("asks for every stage when none is named and answers a missing phone and email as null", async () => {
            const em = mockEntityManager({
                query: [
                    LIST_LEADS,
                    [
                        {
                            id: "lead-1",
                            contact_name: "A",
                            company: "",
                            channel: "API",
                            need: "",
                            stage: "won",
                            phone: undefined,
                            email: undefined,
                            created_at: "2026-10-12T09:00:00.000Z",
                        },
                    ],
                ],
            })
            const { service } = await build(em)

            await expect(service.listLeads("workspace-1", undefined, 10)).resolves.toMatchObject([
                { phone: null, email: null },
            ])
            expect(em.query).toHaveBeenCalledWith(LIST_LEADS, ["workspace-1", null, 10])
        })
    })

    describe("listEvents", () => {
        const row = {
            id: "event-1",
            kind: "api.lead",
            actor: "api:n8n",
            summary: "s",
            evidence: null,
            lead_id: null,
            created_at: "2026-10-12T09:30:00.000Z",
        }

        it("lists the events after since and answers the time of the last one as the next cursor", async () => {
            const em = mockEntityManager({ query: [LIST_EVENTS, [row]] })
            const { service } = await build(em)

            await expect(service.listEvents("workspace-1", "2026-10-12T00:00:00Z", 100)).resolves.toEqual({
                events: [
                    {
                        id: "event-1",
                        kind: "api.lead",
                        actor: "api:n8n",
                        summary: "s",
                        evidence: null,
                        leadId: null,
                        createdAt: "2026-10-12T09:30:00.000Z",
                    },
                ],
                nextSince: "2026-10-12T09:30:00.000Z",
            })

            expect(em.query).toHaveBeenCalledWith(LIST_EVENTS, ["workspace-1", "2026-10-12T00:00:00.000Z", 100])
        })

        it("keeps the start of the window as the cursor when nothing happened, one day back by default", async () => {
            const { service } = await build(mockEntityManager({ query: [LIST_EVENTS, []] }))

            await expect(service.listEvents("workspace-1", undefined, 100)).resolves.toEqual({
                events: [],
                nextSince: "2026-10-11T10:00:00.000Z",
            })
        })

        it("refuses a since that is not a time and reads nothing", async () => {
            const em = mockEntityManager()
            const { service } = await build(em)

            await expect(service.listEvents("workspace-1", "later", 100)).rejects.toMatchObject({
                code: PublicApiErrorCode.SinceInvalid,
            })

            expect(em.query).not.toHaveBeenCalled()
        })
    })

    describe("acceptLead", () => {
        it("writes the inbound event, its evidence and the hand-off job in one transaction and answers the known customer", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    query: [
                        [MATCH_LEAD_BY_PHONE, [{ id: "lead-7" }]],
                        [INSERT_INBOUND_LEAD, [{ id: "inbound-1" }]],
                        [INSERT_EVIDENCE, []],
                    ],
                }),
            )
            const { service, outbox } = await build(tx.em)

            await expect(service.acceptLead(WHO, LEAD)).resolves.toEqual({ leadId: "lead-7", status: "accepted" })

            expect(tx.em.query).toHaveBeenCalledWith(MATCH_LEAD_BY_PHONE, ["workspace-1", "84912000701"])
            expect(tx.em.query).toHaveBeenCalledWith(INSERT_INBOUND_LEAD, [
                "workspace-1",
                "Nguyen A",
                "84912000701",
                "price",
                "api:n8n",
                "api:key-1:crm-9",
                "manual:lead:api:key-1:crm-9",
            ])
            expect(tx.em.query).toHaveBeenCalledWith(INSERT_EVIDENCE, [
                "workspace-1",
                "lead-7",
                "api.lead",
                "api:n8n",
                "Customer received through the API: Nguyen A",
                "source=api:n8n external_id=crm-9",
            ])
            expect(outbox.jobsOf(PUBLIC_API_QUEUE)).toEqual([
                {
                    queue: PUBLIC_API_QUEUE,
                    payload: {
                        kind: "lead",
                        workspaceId: "workspace-1",
                        keyId: "key-1",
                        keyName: "n8n",
                        inboundEventId: "inbound-1",
                        company: "ACME",
                        stage: "qualified",
                        note: "vip",
                    },
                },
            ])
            expect(outbox.allInTransaction).toBe(true)
            expect(tx.commits).toBe(1)
        })

        it("matches by email when the phone matches nobody, answers no customer yet for a new one and uses a fresh event id without an external id", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    query: [
                        [MATCH_LEAD_BY_EMAIL, []],
                        [INSERT_INBOUND_LEAD, [{ id: "inbound-1" }]],
                        [INSERT_EVIDENCE, []],
                    ],
                }),
            )
            const { service } = await build(tx.em)

            await expect(
                service.acceptLead(WHO, { ...LEAD, phone: "", email: "A@B.co", externalId: "", need: "", channel: "" }),
            ).resolves.toEqual({ leadId: null, status: "accepted" })

            expect(tx.em.query).toHaveBeenCalledWith(MATCH_LEAD_BY_EMAIL, ["workspace-1", "a@b.co"])
            expect(tx.em.query).toHaveBeenCalledWith(
                INSERT_INBOUND_LEAD,
                expect.arrayContaining(["Created through the API", expect.stringMatching(/^api:key-1:[0-9a-f-]{36}$/)]),
            )
            expect(tx.em.query).toHaveBeenCalledWith(INSERT_EVIDENCE, expect.arrayContaining([null, "source=api:n8n"]))
        })

        it("answers the customer an email matches", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    query: [
                        [MATCH_LEAD_BY_EMAIL, [{ id: "lead-4" }]],
                        [INSERT_INBOUND_LEAD, [{ id: "inbound-1" }]],
                        [INSERT_EVIDENCE, []],
                    ],
                }),
            )
            const { service } = await build(tx.em)

            await expect(service.acceptLead(WHO, { ...LEAD, phone: "", email: "a@b.co" })).resolves.toEqual({
                leadId: "lead-4",
                status: "accepted",
            })
        })

        it("falls back to the name and channel only when the request has no contact, and tries the email after a missed phone", async () => {
            const noContact = fakeTransaction(
                mockEntityManager({
                    query: [
                        [MATCH_LEAD_BY_NAME, [{ id: "lead-3" }]],
                        [INSERT_INBOUND_LEAD, [{ id: "inbound-1" }]],
                        [INSERT_EVIDENCE, []],
                    ],
                }),
            )
            const first = await build(noContact.em)
            await expect(first.service.acceptLead(WHO, { ...LEAD, phone: "", email: "" })).resolves.toMatchObject({
                leadId: "lead-3",
            })
            expect(noContact.em.query).toHaveBeenCalledWith(MATCH_LEAD_BY_NAME, ["workspace-1", "Nguyen A", "Zalo"])

            const missedPhone = fakeTransaction(
                mockEntityManager({
                    query: [
                        [MATCH_LEAD_BY_PHONE, []],
                        [INSERT_INBOUND_LEAD, [{ id: "inbound-1" }]],
                        [INSERT_EVIDENCE, []],
                    ],
                }),
            )
            const second = await build(missedPhone.em)
            await expect(second.service.acceptLead(WHO, LEAD)).resolves.toEqual({ leadId: null, status: "accepted" })
        })

        it("treats a name that matches nobody as a new customer", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    query: [
                        [MATCH_LEAD_BY_NAME, []],
                        [INSERT_INBOUND_LEAD, [{ id: "inbound-1" }]],
                        [INSERT_EVIDENCE, []],
                    ],
                }),
            )
            const { service } = await build(tx.em)

            await expect(service.acceptLead(WHO, { ...LEAD, phone: "", email: "" })).resolves.toEqual({
                leadId: null,
                status: "accepted",
            })
        })

        it("counts a repeated external id and enqueues nothing", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    query: [
                        [MATCH_LEAD_BY_PHONE, []],
                        [INSERT_INBOUND_LEAD, []],
                        [BUMP_INBOUND_DUPLICATE, [{ lead_id: "lead-2" }]],
                    ],
                }),
            )
            const { service, outbox } = await build(tx.em)

            await expect(service.acceptLead(WHO, LEAD)).resolves.toEqual({ leadId: "lead-2", status: "unchanged" })

            expect(tx.em.query).toHaveBeenCalledWith(BUMP_INBOUND_DUPLICATE, ["workspace-1", "manual:lead:api:key-1:crm-9"])
            expect(outbox.jobs).toEqual([])
        })

        it("answers the matched customer for a repeat whose first delivery has no customer yet, and none when neither knows one", async () => {
            const known = fakeTransaction(
                mockEntityManager({
                    query: [
                        [MATCH_LEAD_BY_PHONE, [{ id: "lead-7" }]],
                        [INSERT_INBOUND_LEAD, []],
                        [BUMP_INBOUND_DUPLICATE, [{ lead_id: null }]],
                    ],
                }),
            )
            const first = await build(known.em)
            await expect(first.service.acceptLead(WHO, LEAD)).resolves.toEqual({ leadId: "lead-7", status: "unchanged" })

            const unknown = fakeTransaction(
                mockEntityManager({
                    query: [
                        [MATCH_LEAD_BY_PHONE, []],
                        [INSERT_INBOUND_LEAD, []],
                        [BUMP_INBOUND_DUPLICATE, []],
                    ],
                }),
            )
            const second = await build(unknown.em)
            await expect(second.service.acceptLead(WHO, LEAD)).resolves.toEqual({ leadId: null, status: "unchanged" })
        })

        it("rolls the event back when its job cannot be enqueued", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    query: [
                        [MATCH_LEAD_BY_PHONE, []],
                        [INSERT_INBOUND_LEAD, [{ id: "inbound-1" }]],
                        [INSERT_EVIDENCE, []],
                    ],
                }),
            )
            const { service, outbox } = await build(tx.em)
            const failure = new Error("queue missing")
            outbox.failNext("write", failure)

            await expect(service.acceptLead(WHO, LEAD)).rejects.toBe(failure)

            expect(tx.rollbacks).toBe(1)
        })
    })

    describe("acceptMessage", () => {
        it("queues the message for the named conversation with the idempotency key as its dedupe key", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    query: [
                        [SELECT_CONVERSATION, [{ id: "conv-1", lead_id: "lead-1" }]],
                        [INSERT_EVIDENCE, []],
                    ],
                }),
            )
            const { service, outbox } = await build(tx.em)

            await expect(service.acceptMessage(WHO, MESSAGE)).resolves.toEqual({ conversationId: "conv-1", status: "queued" })

            expect(tx.em.query).toHaveBeenCalledWith(SELECT_CONVERSATION, ["workspace-1", "conv-1"])
            expect(outbox.jobsOf(PUBLIC_API_QUEUE)).toEqual([
                {
                    queue: PUBLIC_API_QUEUE,
                    payload: {
                        kind: "message",
                        workspaceId: "workspace-1",
                        keyId: "key-1",
                        keyName: "n8n",
                        conversationId: "conv-1",
                        leadId: "lead-1",
                        text: "hello",
                        requireApproval: true,
                        dedupeKey: expect.stringMatching(/^api:message:key-1:[0-9a-f]{24}$/),
                    },
                },
            ])
            expect(outbox.allInTransaction).toBe(true)
        })

        it("finds the latest conversation of a customer and gives a request without an idempotency key its own dedupe key", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    query: [
                        [SELECT_CONVERSATION_OF_LEAD, [{ id: "conv-2", lead_id: "lead-1" }]],
                        [INSERT_EVIDENCE, []],
                    ],
                }),
            )
            const { service, outbox } = await build(tx.em)

            await service.acceptMessage(WHO, { ...MESSAGE, conversationId: "", leadId: "lead-1", idempotencyKey: null })
            await service.acceptMessage(WHO, { ...MESSAGE, conversationId: "", leadId: "lead-1", idempotencyKey: null })

            const keys = outbox.jobs.map((job) => (job.payload as { dedupeKey: string }).dedupeKey)
            expect(keys).toHaveLength(2)
            expect(keys[0]).not.toBe(keys[1])
        })

        it("refuses a conversation of another workspace and queues nothing", async () => {
            const tx = fakeTransaction(mockEntityManager({ query: [SELECT_CONVERSATION, []] }))
            const { service, outbox } = await build(tx.em)

            await expect(service.acceptMessage(WHO, MESSAGE)).rejects.toMatchObject({
                code: PublicApiErrorCode.ConversationNotFound,
            })

            expect(outbox.jobs).toEqual([])
            expect(tx.rollbacks).toBe(1)
        })

        it("refuses a request that names neither a conversation nor a customer", async () => {
            const em = mockEntityManager()
            const { service } = await build(em)

            await expect(service.acceptMessage(WHO, { ...MESSAGE, conversationId: "" })).rejects.toMatchObject({
                code: PublicApiErrorCode.TargetMissing,
            })

            expect(em.query).not.toHaveBeenCalled()
        })
    })

    describe("acceptKnowledge", () => {
        it("writes the queued source, its evidence and its indexing job in one transaction", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    query: [
                        [INSERT_KNOWLEDGE_SOURCE, [{ id: "source-1" }]],
                        [INSERT_EVIDENCE, []],
                    ],
                }),
            )
            const { service, outbox } = await build(tx.em)

            await expect(service.acceptKnowledge(WHO, KNOWLEDGE)).resolves.toEqual({ id: "source-1", status: "queued" })

            expect(tx.em.query).toHaveBeenCalledWith(INSERT_KNOWLEDGE_SOURCE, [
                "workspace-1",
                "Price",
                ["a"],
                "public",
                "Prices",
                "A is 1",
                "api:n8n",
            ])
            expect(outbox.jobsOf(PUBLIC_API_QUEUE)).toEqual([
                { queue: PUBLIC_API_QUEUE, payload: { kind: "knowledge", workspaceId: "workspace-1", sourceId: "source-1" } },
            ])
            expect(outbox.allInTransaction).toBe(true)
        })

        it("stores no topic when the caller names none", async () => {
            const tx = fakeTransaction(
                mockEntityManager({
                    query: [
                        [INSERT_KNOWLEDGE_SOURCE, [{ id: "source-1" }]],
                        [INSERT_EVIDENCE, []],
                    ],
                }),
            )
            const { service } = await build(tx.em)

            await service.acceptKnowledge(WHO, { ...KNOWLEDGE, topic: "" })

            expect(tx.em.query).toHaveBeenCalledWith(INSERT_KNOWLEDGE_SOURCE, expect.arrayContaining([null]))
        })

        it("refuses a text over the limit before any query", async () => {
            const em = mockEntityManager()
            const { service } = await build(em)

            await expect(
                service.acceptKnowledge(WHO, { ...KNOWLEDGE, content: "x".repeat(120_001) }),
            ).rejects.toMatchObject({ code: PublicApiErrorCode.ContentTooLong, params: { max: 120_000 } })

            expect(em.query).not.toHaveBeenCalled()
        })

        it("refuses when the insert answers no row", async () => {
            const tx = fakeTransaction(mockEntityManager({ query: [INSERT_KNOWLEDGE_SOURCE, []] }))
            const { service, outbox } = await build(tx.em)

            await expect(service.acceptKnowledge(WHO, KNOWLEDGE)).rejects.toMatchObject({
                code: PublicApiErrorCode.NotWritten,
            })

            expect(outbox.jobs).toEqual([])
        })
    })
})
