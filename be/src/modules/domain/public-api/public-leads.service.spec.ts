import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import type { MockEntityManager, RecordingQueueOutbox } from "@starci/jest-preset"
import { ApiKeysService } from "@modules/domain/api-keys"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { PUBLIC_API_QUEUE, PublicApiQueue } from "@modules/queues/public-api"
import { PublicApiErrorCode } from "./errors/public-api.error"
import type { AcceptLeadParams } from "./public-api.contracts"
import { PublicLeadsService } from "./public-leads.service"
import {
    INSERT_REQUEST,
    LIST_LEADS,
    MATCH_LEAD_BY_EMAIL,
    MATCH_LEAD_BY_NAME,
    MATCH_LEAD_BY_PHONE,
} from "./persistence/public-api.sql"

const WHO = { keyId: "key-1", workspaceId: "workspace-1", name: "n8n", scopes: [] }

const AUTH = "Bearer nvk_secret"

const LEAD: AcceptLeadParams = {
    authorization: AUTH,
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

const LEAD_ROW = {
    id: "lead-1",
    contact_name: "A",
    company: "ACME",
    channel: "Zalo",
    need: "price",
    stage: "new",
    phone: "84912000701",
    email: null,
    created_at: "2026-10-12T09:00:00.000Z",
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
            PublicLeadsService,
            { provide: PublicApiQueue, useValue: queue },
            { provide: ApiKeysService, useValue: keys },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
        ],
    }).compile()
    return { service: moduleRef.get(PublicLeadsService), outbox, keys }
}

const transactionOf = (...stubs: ReadonlyArray<readonly [string, ReadonlyArray<object>]>) =>
    fakeTransaction(mockEntityManager({ query: stubs }))

describe("PublicLeadsService / listLeads", () => {
    it("admits the key for leads:read and lists the workspace customers with the stage filter and the limit", async () => {
        const em = mockEntityManager({ query: [LIST_LEADS, [LEAD_ROW]] })
        const { service, keys } = await build(em)

        await expect(service.listLeads({ authorization: AUTH, stage: "new", limit: "20" })).resolves.toEqual([
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

        expect(keys.authenticate).toHaveBeenCalledWith("leads:read", AUTH)
        expect(em.query).toHaveBeenCalledWith(LIST_LEADS, ["workspace-1", "new", 20])
    })
    it("asks for every stage, fifty customers when none is named and at most two hundred", async () => {
        const em = mockEntityManager({ query: [LIST_LEADS, [{ ...LEAD_ROW, phone: undefined, email: undefined }]] })
        const { service } = await build(em)

        await expect(service.listLeads({ authorization: AUTH })).resolves.toMatchObject([{ phone: null, email: null }])
        await service.listLeads({ authorization: AUTH, limit: "9999" })

        expect(em.query).toHaveBeenNthCalledWith(1, LIST_LEADS, ["workspace-1", null, 50])
        expect(em.query).toHaveBeenNthCalledWith(2, LIST_LEADS, ["workspace-1", null, 200])
    })
    it("stops at a refused key before any query", async () => {
        const em = mockEntityManager()
        const { service, keys } = await build(em)
        const refused = new Error("API_KEYS_UNAUTHORIZED")
        keys.authenticate.mockRejectedValue(refused)

        await expect(service.listLeads({ authorization: undefined })).rejects.toBe(refused)

        expect(em.query).not.toHaveBeenCalled()
    })
})

describe("PublicLeadsService / acceptLead", () => {
    it("admits leads:write, records and queues the request in one transaction, and returns the known customer", async () => {
        const tx = transactionOf([MATCH_LEAD_BY_PHONE, [{ id: "lead-7" }]], [INSERT_REQUEST, [RECORDED]])
        const { service, outbox, keys } = await build(tx.em)

        await expect(service.acceptLead(LEAD)).resolves.toEqual({ leadId: "lead-7", status: "accepted" })

        expect(keys.authenticate).toHaveBeenCalledWith("leads:write", AUTH)
        expect(tx.em.query).toHaveBeenCalledWith(MATCH_LEAD_BY_PHONE, ["workspace-1", "84912000701"])
        expect(tx.em.query).toHaveBeenCalledWith(INSERT_REQUEST, [
            "workspace-1",
            "key-1",
            "lead",
            "lead:key-1:",
            "crm-9",
            JSON.stringify({
                name: "Nguyen A",
                contact: "84912000701",
                need: "price",
                channel: "Zalo",
                company: "ACME",
                note: "vip",
                stage: "qualified",
                externalId: "crm-9",
                source: "api:n8n",
            }),
        ])
        expect(outbox.jobsOf(PUBLIC_API_QUEUE)).toEqual([
            { queue: PUBLIC_API_QUEUE, payload: { requestId: "request-1", workspaceId: "workspace-1" } },
        ])
        expect(outbox.allInTransaction).toBe(true)
        expect(tx.commits).toBe(1)
    })
    it("matches by email and takes the defaults of a bare request", async () => {
        const tx = transactionOf([MATCH_LEAD_BY_EMAIL, []], [INSERT_REQUEST, [RECORDED]])
        const { service } = await build(tx.em)

        await expect(service.acceptLead({ authorization: AUTH, name: "Nguyen A", email: "A@B.co" })).resolves.toEqual({
            leadId: null,
            status: "accepted",
        })

        expect(tx.em.query).toHaveBeenCalledWith(MATCH_LEAD_BY_EMAIL, ["workspace-1", "a@b.co"])
        expect(tx.em.query).toHaveBeenCalledWith(INSERT_REQUEST, [
            "workspace-1",
            "key-1",
            "lead",
            "lead:key-1:",
            "",
            JSON.stringify({
                name: "Nguyen A",
                contact: "a@b.co",
                need: "Created through the API",
                channel: "API",
                company: "",
                note: "",
                stage: null,
                externalId: "",
                source: "api:n8n",
            }),
        ])
    })
})

describe("PublicLeadsService / acceptLead", () => {
    it("answers the customer an email matches", async () => {
        const tx = transactionOf([MATCH_LEAD_BY_EMAIL, [{ id: "lead-4" }]], [INSERT_REQUEST, [RECORDED]])
        const { service } = await build(tx.em)

        await expect(service.acceptLead({ ...LEAD, phone: "", email: "a@b.co" })).resolves.toEqual({
            leadId: "lead-4",
            status: "accepted",
        })
    })
    it("falls back to the name and channel only when the request has no contact", async () => {
        const tx = transactionOf([MATCH_LEAD_BY_NAME, [{ id: "lead-3" }]], [INSERT_REQUEST, [RECORDED]])
        const { service } = await build(tx.em)

        await expect(service.acceptLead({ ...LEAD, phone: "", email: "" })).resolves.toMatchObject({
            leadId: "lead-3",
        })
        expect(tx.em.query).toHaveBeenCalledWith(MATCH_LEAD_BY_NAME, ["workspace-1", "Nguyen A", "Zalo"])
    })
    it("treats a name that matches nobody as a new customer and a phone that matches nobody likewise", async () => {
        const named = transactionOf([MATCH_LEAD_BY_NAME, []], [INSERT_REQUEST, [RECORDED]])
        const first = await build(named.em)
        await expect(first.service.acceptLead({ ...LEAD, phone: "", email: "" })).resolves.toEqual({
            leadId: null,
            status: "accepted",
        })

        const phoned = transactionOf([MATCH_LEAD_BY_PHONE, []], [INSERT_REQUEST, [RECORDED]])
        const second = await build(phoned.em)
        await expect(second.service.acceptLead(LEAD)).resolves.toEqual({ leadId: null, status: "accepted" })
    })
    it("answers the customer of a repeated request and enqueues nothing", async () => {
        const tx = transactionOf(
            [MATCH_LEAD_BY_PHONE, []],
            [INSERT_REQUEST, [{ id: "request-1", lead_id: "lead-2", inserted: false }]],
        )
        const { service, outbox } = await build(tx.em)

        await expect(service.acceptLead(LEAD)).resolves.toEqual({ leadId: "lead-2", status: "unchanged" })

        expect(outbox.jobs).toEqual([])
    })
    it("returns the matched customer for a repeat without an earlier customer, and none when neither knows one", async () => {
        const known = transactionOf(
            [MATCH_LEAD_BY_PHONE, [{ id: "lead-7" }]],
            [INSERT_REQUEST, [{ id: "request-1", lead_id: null, inserted: false }]],
        )
        const first = await build(known.em)
        await expect(first.service.acceptLead(LEAD)).resolves.toEqual({ leadId: "lead-7", status: "unchanged" })

        const unknown = transactionOf(
            [MATCH_LEAD_BY_PHONE, []],
            [INSERT_REQUEST, [{ id: "request-1", lead_id: null, inserted: false }]],
        )
        const second = await build(unknown.em)
        await expect(second.service.acceptLead(LEAD)).resolves.toEqual({ leadId: null, status: "unchanged" })
    })
})

describe("PublicLeadsService / acceptLead", () => {
    it("refuses when the ledger answers no row", async () => {
        const tx = transactionOf([MATCH_LEAD_BY_PHONE, []], [INSERT_REQUEST, []])
        const { service, outbox } = await build(tx.em)

        await expect(service.acceptLead(LEAD)).rejects.toMatchObject({ code: PublicApiErrorCode.NotWritten })

        expect(outbox.jobs).toEqual([])
    })
})

describe("PublicLeadsService / acceptLead", () => {
    it("rolls the request back when its job cannot be enqueued", async () => {
        const tx = transactionOf([MATCH_LEAD_BY_PHONE, []], [INSERT_REQUEST, [RECORDED]])
        const { service, outbox } = await build(tx.em)
        const failure = new Error("queue missing")
        outbox.failNext("write", failure)

        await expect(service.acceptLead(LEAD)).rejects.toBe(failure)

        expect(tx.rollbacks).toBe(1)
    })
    it("stops at a refused key before any query", async () => {
        const em = mockEntityManager()
        const { service, keys } = await build(em)
        const refused = new Error("API_KEYS_SCOPE_MISSING")
        keys.authenticate.mockRejectedValue(refused)

        await expect(service.acceptLead(LEAD)).rejects.toBe(refused)

        expect(em.query).not.toHaveBeenCalled()
    })
})
