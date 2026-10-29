import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import type { MockEntityManager, RecordingQueueOutbox } from "@starci/jest-preset"
import { answerQueryBuilders, fakeQueryBuilder } from "@tests/fixtures/builders/fake-query-builder.builder"
import { ledgerExpected, ledgerWritten } from "@tests/fixtures/builders/public-api-ledger.builder"
import { ApiKeysService } from "@modules/domain/api-keys"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { PUBLIC_API_QUEUE, PublicApiQueue } from "@modules/queues/public-api"
import { PublicApiErrorCode } from "./errors/public-api.error"
import type { AcceptKnowledgeParams } from "./public-api.contracts"
import { PublicKnowledgeService } from "./public-knowledge.service"
import { PublicApiLedgerService } from "./public-api-ledger.service"

const WHO = { keyId: "key-1", workspaceId: "workspace-1", name: "n8n", scopes: [] }

const AUTH = "Bearer nvk_secret"

const KNOWLEDGE: AcceptKnowledgeParams = {
    authorization: AUTH,
    title: "Prices",
    content: "A is 1",
    topic: "Price",
    visibility: "public",
    tags: [" a ", ""],
}

const RECORDED = { id: "request-1", lead_id: null, inserted: true }

const build = async (entityManager: MockEntityManager) => {
    const outbox: RecordingQueueOutbox = recordingQueueOutbox()
    const queue = mock<PublicApiQueue>({
        enqueueRequest: (payload, tx) => outbox.write(tx, PUBLIC_API_QUEUE, payload),
    })
    const keys = mock<ApiKeysService>()
    keys.authenticate.mockResolvedValue(WHO)
    const moduleRef = await Test.createTestingModule({
        providers: [
            PublicKnowledgeService,
            { provide: PublicApiQueue, useValue: queue },
            { provide: ApiKeysService, useValue: keys },
            PublicApiLedgerService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
        ],
    }).compile()
    return { service: moduleRef.get(PublicKnowledgeService), outbox, keys }
}

describe("PublicKnowledgeService / acceptKnowledge", () => {
    it("admits the key for knowledge:write and records the request and its job in one transaction", async () => {
        const tx = fakeTransaction(mockEntityManager())
        const write = fakeQueryBuilder({ execute: { raw: [RECORDED] } })
        answerQueryBuilders(tx.em, write)
        const { service, outbox, keys } = await build(tx.em)

        await expect(service.acceptKnowledge(KNOWLEDGE)).resolves.toEqual({ id: "request-1", status: "queued" })

        expect(keys.authenticate).toHaveBeenCalledWith("knowledge:write", AUTH)
        expect(ledgerWritten(write)).toEqual(
            ledgerExpected({
                workspaceId: "workspace-1",
                keyId: "key-1",
                kind: "knowledge",
                prefix: "knowledge:key-1:",
                suffix: "",
                body: {
                    title: "Prices",
                    content: "A is 1",
                    topic: "Price",
                    tags: ["a"],
                    visibility: "public",
                    source: "api:n8n",
                },
            }),
        )
        expect(outbox.jobsOf(PUBLIC_API_QUEUE)).toEqual([
            { queue: PUBLIC_API_QUEUE, payload: { requestId: "request-1", workspaceId: "workspace-1" } },
        ])
        expect(outbox.allInTransaction).toBe(true)
    })
    it("records no topic, no tags and an internal source when the caller names none", async () => {
        const tx = fakeTransaction(mockEntityManager())
        const write = fakeQueryBuilder({ execute: { raw: [RECORDED] } })
        answerQueryBuilders(tx.em, write)
        const { service } = await build(tx.em)

        await service.acceptKnowledge({ authorization: AUTH, title: "Prices", content: "A is 1" })

        expect(ledgerWritten(write)).toEqual(
            ledgerExpected({
                workspaceId: "workspace-1",
                keyId: "key-1",
                kind: "knowledge",
                prefix: "knowledge:key-1:",
                suffix: "",
                body: {
                    title: "Prices",
                    content: "A is 1",
                    topic: null,
                    tags: [],
                    visibility: "internal",
                    source: "api:n8n",
                },
            }),
        )
    })
    it("refuses a text over the limit before any query", async () => {
        const em = mockEntityManager()
        const { service } = await build(em)

        await expect(service.acceptKnowledge({ ...KNOWLEDGE, content: "x".repeat(120_001) })).rejects.toMatchObject({
            code: PublicApiErrorCode.ContentTooLong,
            params: { max: 120_000 },
        })

        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})

describe("PublicKnowledgeService / acceptKnowledge", () => {
    it("refuses when the ledger answers no row", async () => {
        const tx = fakeTransaction(mockEntityManager())
        answerQueryBuilders(tx.em, fakeQueryBuilder({ execute: { raw: [] } }))
        const { service, outbox } = await build(tx.em)

        await expect(service.acceptKnowledge(KNOWLEDGE)).rejects.toMatchObject({
            code: PublicApiErrorCode.NotWritten,
        })

        expect(outbox.jobs).toEqual([])
    })
    it("stops at a refused key before any query", async () => {
        const em = mockEntityManager()
        const { service, keys } = await build(em)
        const refused = new Error("API_KEYS_SCOPE_MISSING")
        keys.authenticate.mockRejectedValue(refused)

        await expect(service.acceptKnowledge(KNOWLEDGE)).rejects.toBe(refused)

        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})
