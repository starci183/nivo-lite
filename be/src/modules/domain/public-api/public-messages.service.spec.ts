import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import type { MockEntityManager, RecordingQueueOutbox } from "@starci/jest-preset"
import { answerQueryBuilders, fakeQueryBuilder } from "@tests/fixtures/builders/fake-query-builder.builder"
import { ledgerExpected, ledgerWritten } from "@tests/fixtures/builders/public-api-ledger.builder"
import { AgentConversationsReadService } from "@modules/domain/agent-conversations"
import { ApiKeysService } from "@modules/domain/api-keys"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { PUBLIC_API_QUEUE, PublicApiQueue } from "@modules/queues/public-api"
import { PublicApiErrorCode } from "./errors/public-api.error"
import type { AcceptMessageParams } from "./public-api.contracts"
import { PublicMessagesService } from "./public-messages.service"
import { PublicApiLedgerService } from "./public-api-ledger.service"
import { PublicConversationsService } from "./public-conversations.service"
import { messageDedupeSuffix } from "./public-api.policy"

const WHO = { keyId: "key-1", workspaceId: "workspace-1", name: "n8n", scopes: [] }

const AUTH = "Bearer nvk_secret"

const MESSAGE: AcceptMessageParams = {
    authorization: AUTH,
    text: "hello",
    conversationId: "conv-1",
    leadId: "",
    requireApproval: true,
    idempotencyKey: "idem-1",
}

const RECORDED = { id: "request-1", lead_id: null, inserted: true }

/** The conversation the conversation reads answer, or none. */
let primed: { readonly id: string; readonly lead_id: string | null } | undefined

/** A transaction whose conversation lookups answer the given conversation and whose one query builder is the ledger insert. */
const transactionOf = (
    conversation: { readonly id: string; readonly lead_id: string | null } | undefined,
    ledger: ReadonlyArray<object>,
) => {
    primed = conversation
    const em = mockEntityManager()
    const write = fakeQueryBuilder({ execute: { raw: ledger } })
    answerQueryBuilders(em, write)
    return Object.assign(fakeTransaction(em), { write })
}

const build = async (entityManager: MockEntityManager) => {
    const outbox: RecordingQueueOutbox = recordingQueueOutbox()
    const queue = mock<PublicApiQueue>({
        enqueueRequest: (payload, tx) => outbox.write(tx, PUBLIC_API_QUEUE, payload),
    })
    const keys = mock<ApiKeysService>()
    keys.authenticate.mockResolvedValue(WHO)
    const chats = mock<AgentConversationsReadService>()
    const answer = () => Promise.resolve(primed === undefined ? null : { id: primed.id, leadId: primed.lead_id })
    chats.customerChat.mockImplementation(answer)
    chats.latestCustomerChatOfLead.mockImplementation(answer)
    const moduleRef = await Test.createTestingModule({
        providers: [
            PublicMessagesService,
            { provide: PublicApiQueue, useValue: queue },
            { provide: ApiKeysService, useValue: keys },
            PublicApiLedgerService,
            PublicConversationsService,
            { provide: AgentConversationsReadService, useValue: chats },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
        ],
    }).compile()
    return { service: moduleRef.get(PublicMessagesService), outbox, keys, chats }
}

describe("PublicMessagesService / acceptMessage", () => {
    it("admits messages:write and queues the conversation message with its idempotency key", async () => {
        const tx = transactionOf({ id: "conv-1", lead_id: "lead-1" }, [RECORDED])
        const { service, outbox, keys, chats } = await build(tx.em)

        await expect(service.acceptMessage(MESSAGE)).resolves.toEqual({
            conversationId: "conv-1",
            status: "queued",
        })

        expect(keys.authenticate).toHaveBeenCalledWith("messages:write", AUTH)
        expect(chats.customerChat).toHaveBeenCalledWith("workspace-1", "conv-1", expect.anything())
        expect(ledgerWritten(tx.write)).toEqual(
            ledgerExpected({
                workspaceId: "workspace-1",
                keyId: "key-1",
                kind: "message",
                prefix: "message:key-1:",
                suffix: messageDedupeSuffix("idem-1", "conv-1"),
                body: {
                    conversationId: "conv-1",
                    leadId: "lead-1",
                    text: "hello",
                    requireApproval: true,
                    source: "api:n8n",
                },
            }),
        )
        expect(outbox.jobsOf(PUBLIC_API_QUEUE)).toEqual([
            { queue: PUBLIC_API_QUEUE, payload: { requestId: "request-1", workspaceId: "workspace-1" } },
        ])
        expect(outbox.allInTransaction).toBe(true)
    })
})

describe("PublicMessagesService / acceptMessage", () => {
    it("finds the latest conversation of a customer and keys a request without an idempotency key by nothing", async () => {
        const tx = transactionOf({ id: "conv-2", lead_id: "lead-1" }, [RECORDED])
        const { service, chats } = await build(tx.em)

        await service.acceptMessage({ authorization: AUTH, text: "hello", leadId: "lead-1" })

        expect(chats.latestCustomerChatOfLead).toHaveBeenCalledWith("workspace-1", "lead-1", expect.anything())
        expect(ledgerWritten(tx.write)).toEqual(
            ledgerExpected({
                workspaceId: "workspace-1",
                keyId: "key-1",
                kind: "message",
                prefix: "message:key-1:",
                suffix: "",
                body: {
                    conversationId: "conv-2",
                    leadId: "lead-1",
                    text: "hello",
                    requireApproval: false,
                    source: "api:n8n",
                },
            }),
        )
    })
})

describe("PublicMessagesService / acceptMessage", () => {
    it("answers queued for a repeated idempotency key and enqueues nothing again", async () => {
        const tx = transactionOf({ id: "conv-1", lead_id: null }, [{ id: "request-1", lead_id: null, inserted: false }])
        const { service, outbox } = await build(tx.em)

        await expect(service.acceptMessage(MESSAGE)).resolves.toEqual({
            conversationId: "conv-1",
            status: "queued",
        })

        expect(outbox.jobs).toEqual([])
    })
    it("refuses a conversation of another workspace and queues nothing", async () => {
        const tx = transactionOf(undefined, [])
        const { service, outbox } = await build(tx.em)

        await expect(service.acceptMessage(MESSAGE)).rejects.toMatchObject({
            code: PublicApiErrorCode.ConversationNotFound,
        })

        expect(outbox.jobs).toEqual([])
        expect(tx.rollbacks).toBe(1)
    })
    it("refuses when the ledger answers no row", async () => {
        const tx = transactionOf({ id: "conv-1", lead_id: null }, [])
        const { service } = await build(tx.em)

        await expect(service.acceptMessage(MESSAGE)).rejects.toMatchObject({ code: PublicApiErrorCode.NotWritten })
    })
    it("refuses a request that names neither a conversation nor a customer", async () => {
        const em = mockEntityManager()
        const { service } = await build(em)

        await expect(service.acceptMessage({ authorization: AUTH, text: "hello" })).rejects.toMatchObject({
            code: PublicApiErrorCode.TargetMissing,
        })

        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})

describe("PublicMessagesService / acceptMessage", () => {
    it("stops at a refused key before any query", async () => {
        const em = mockEntityManager()
        const { service, keys } = await build(em)
        const refused = new Error("API_KEYS_SCOPE_MISSING")
        keys.authenticate.mockRejectedValue(refused)

        await expect(service.acceptMessage(MESSAGE)).rejects.toBe(refused)

        expect(em.createQueryBuilder).not.toHaveBeenCalled()
    })
})
