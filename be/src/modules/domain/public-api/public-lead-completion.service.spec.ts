import { Test } from "@nestjs/testing"
import { fakeInbox, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { WorkContext, WorkItem } from "@modules/domain/decisions"
import { InboundEventsService } from "@modules/domain/inbound-events"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { INBOX } from "@modules/platform/inbox"
import { PublicApiError, PublicApiErrorCode } from "./errors/public-api.error"
import type { LeadRequestBody } from "./public-api.contracts"
import { PublicLeadCompletionService } from "./public-lead-completion.service"
import { PublicLeadFulfillmentService } from "./public-lead-fulfillment.service"
import { publicLeadMetadata } from "./public-lead-metadata.policy"
import { PublicApiEntity } from "./persistence/entities"
import { PublicApiLedgerService } from "./public-api-ledger.service"

const requestId = "11111111-1111-4111-8111-111111111111"
const inboundId = "22222222-2222-4222-8222-222222222222"
const ctx: WorkContext = { workspaceId: "ws-1", actor: "NIVO", locale: "en" }
const body: LeadRequestBody = {
    name: "Lan",
    contact: "84901234567",
    need: "Created through the API",
    needSupplied: false,
    channel: "API",
    company: "Hue Tea",
    note: "Send a quote",
    stage: "won",
    externalId: "crm-10",
    source: "api:CRM",
}
const event = {
    id: inboundId,
    workspace_id: ctx.workspaceId,
    channel: "manual",
    kind: "lead",
    sender_name: body.name,
    sender_contact: body.contact,
    body: body.need,
    amount_vnd: null,
    external_ref: body.source,
    event_id: `api:${requestId}`,
    lead_id: null,
    status: "received",
}
const row: PublicApiEntity = {
    id: requestId,
    workspaceId: ctx.workspaceId,
    keyId: "key-1",
    kind: "lead",
    dedupeKey: "lead:key-1:crm-10",
    payload: body,
    needSupplied: false,
    leadId: null,
    duplicates: 0,
    processedAt: new Date("2026-10-25T00:00:00Z"),
    createdAt: new Date("2026-10-24T23:00:00Z"),
    updatedAt: new Date("2026-10-25T00:00:00Z"),
}
const item = (ledgerRequestId: string | null = requestId) =>
    mock<WorkItem>({
        workspace_id: ctx.workspaceId,
        action: "handoff_lead",
        subject_type: "inbound",
        subject_id: inboundId,
        inbound_event_id: inboundId,
        proposal: {
            summary: "Handoff",
            fields: {
                public_api_lead: publicLeadMetadata(ledgerRequestId ?? inboundId, ledgerRequestId, body),
            },
        },
    })

const build = async (rows: ReadonlyArray<PublicApiEntity> = [row]) => {
    const tx = fakeTransaction(
        mockEntityManager({
            findOne: [PublicApiEntity, rows[0] ?? null],
            update: [PublicApiEntity, { affected: 1 }],
        }),
    )
    const inbox = fakeInbox()
    jest.spyOn(inbox, "claim")
    const inbound = mock<InboundEventsService>({ find: jest.fn().mockResolvedValue(event) })
    const fulfillment = mock<PublicLeadFulfillmentService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            PublicLeadCompletionService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: INBOX, useValue: inbox },
            { provide: InboundEventsService, useValue: inbound },
            { provide: PublicLeadFulfillmentService, useValue: fulfillment },
            PublicApiLedgerService,
        ],
    }).compile()
    return { service: moduleRef.get(PublicLeadCompletionService), tx, inbox, inbound, fulfillment }
}

const complete = (service: PublicLeadCompletionService, input: WorkItem, leadId: string) =>
    service.complete(ctx, input, leadId, input.proposal, false)

const capturedDetails = { ...body, company: "", needSupplied: false }

describe("PublicLeadCompletionService", () => {
    it("leaves a non-API handoff alone without opening a transaction", async () => {
        const { service, tx, inbox, fulfillment } = await build()

        await complete(service, mock<WorkItem>({ proposal: { summary: "Ordinary", fields: {} } }), "lead-1")

        expect(tx.outcomes).toEqual([])
        expect(inbox.claim).not.toHaveBeenCalled()
        expect(fulfillment.applyDetails).not.toHaveBeenCalled()
    })

    it("settles with the persisted admission and links the resolved customer in the same transaction as its inbox claim", async () => {
        const { service, tx, inbox, inbound, fulfillment } = await build()
        const input = item()

        await complete(service, input, "lead-1")

        expect(tx.outcomes).toEqual(["commit"])
        expect(inbound.find).toHaveBeenCalledWith(ctx.workspaceId, inboundId, expect.anything())
        const manager = inbound.find.mock.calls[0]?.[2]
        expect(inbox.claim).toHaveBeenCalledWith("public_api.handoff", `${ctx.workspaceId}:${requestId}`, manager)
        expect(fulfillment.applyDetails).toHaveBeenCalledWith(
            { ...ctx, actor: body.source },
            "lead-1",
            capturedDetails,
            manager,
        )
        expect(tx.em.update).toHaveBeenCalledWith(
            PublicApiEntity,
            { workspaceId: ctx.workspaceId, id: requestId, kind: "lead" },
            { leadId: "lead-1" },
        )
    })

    it("uses the authoritative ledger body and presence flag rather than a copied proposal body", async () => {
        const admitted = { ...body, note: "Authoritative note", needSupplied: true }
        const { service, fulfillment } = await build([{ ...row, payload: admitted, needSupplied: true }])

        await complete(service, item(), "lead-1")

        expect(fulfillment.applyDetails.mock.calls[0]?.[2]).toEqual({ ...admitted, company: "", needSupplied: false })
    })

    it("does not repeat settlement or ledger linking after the completion inbox was already committed", async () => {
        const { service, tx, inbox, fulfillment } = await build()
        inbox.seen("public_api.handoff", `${ctx.workspaceId}:${requestId}`)

        await complete(service, item(), "lead-1")

        expect(tx.outcomes).toEqual(["commit"])
        expect(fulfillment.applyDetails).not.toHaveBeenCalled()
        expect(tx.em.update).not.toHaveBeenCalled()
    })
})

describe("PublicLeadCompletionService handoff validation", () => {
    it.each([
        { workspace_id: "another-workspace" },
        { action: "reply_customer" },
        { subject_type: "lead" as const },
        { inbound_event_id: null },
        { subject_id: "another-input" },
    ])("refuses metadata attached to the wrong work item before any transaction: %p", async (patch) => {
        const { service, tx } = await build()

        await expect(complete(service, { ...item(), ...patch }, "lead-1")).rejects.toThrow(
            PublicApiErrorCode.RequestInvalid,
        )

        expect(tx.outcomes).toEqual([])
    })

    it.each([null, { ...event, kind: "message" }, { ...event, channel: "telegram" }])(
        "refuses an absent or non-API inbound event: %p",
        async (input) => {
            const { service, tx, inbound, inbox } = await build()
            inbound.find.mockResolvedValue(input)

            await expect(complete(service, item(), "lead-1")).rejects.toThrow(PublicApiErrorCode.RequestInvalid)

            expect(tx.outcomes).toEqual(["rollback"])
            expect(inbox.claim).not.toHaveBeenCalled()
        },
    )

    it.each([
        { rows: [] },
        { rows: [{ ...row, kind: "message" as const }] },
        { rows: [{ ...row, processedAt: null }] },
    ])("refuses an unavailable or uncommitted ledger admission: %p", async ({ rows }) => {
        const { service, tx, inbox } = await build(rows)

        await expect(complete(service, item(), "lead-1")).rejects.toThrow(PublicApiErrorCode.RequestInvalid)

        expect(tx.outcomes).toEqual(["rollback"])
        expect(inbox.claim).not.toHaveBeenCalled()
    })

    it.each([{ event_id: "wrong-request" }, { external_ref: "api:SomeoneElse" }])(
        "refuses a ledger admission that does not own the handoff input: %p",
        async (patch) => {
            const { service, tx, inbound } = await build()
            inbound.find.mockResolvedValue({ ...event, ...patch })

            await expect(complete(service, item(), "lead-1")).rejects.toThrow(PublicApiErrorCode.RequestInvalid)

            expect(tx.outcomes).toEqual(["rollback"])
        },
    )
})

describe("PublicLeadCompletionService historical handoff", () => {
    it("settles a historical inline request once using its original inbound identity and no ledger mutation", async () => {
        const { service, tx, inbox, fulfillment } = await build()

        await complete(service, item(null), "lead-1")

        expect(inbox.claim).toHaveBeenCalledWith(
            "public_api.handoff",
            `${ctx.workspaceId}:${inboundId}`,
            expect.anything(),
        )
        expect(fulfillment.applyDetails).toHaveBeenCalledWith(
            { ...ctx, actor: body.source },
            "lead-1",
            capturedDetails,
            expect.anything(),
        )
        expect(tx.em.findOne).not.toHaveBeenCalled()
        expect(tx.outcomes).toEqual(["commit"])
    })

    it.each([
        { id: requestId },
        { external_ref: "api:SomeoneElse" },
        { body: "another-need" },
        { sender_contact: "another-contact" },
        { sender_name: "another-person" },
        { sender_name: null },
    ])("refuses copied historical metadata that does not match its durable input: %p", async (patch) => {
        const { service, tx, inbound } = await build()
        inbound.find.mockResolvedValue({ ...event, ...patch })

        await expect(complete(service, item(null), "lead-1")).rejects.toThrow(PublicApiErrorCode.RequestInvalid)

        expect(tx.outcomes).toEqual(["rollback"])
    })

    it("accepts an empty sender name when the historical input stored no name", async () => {
        const { service, inbound, fulfillment } = await build()
        inbound.find.mockResolvedValue({ ...event, sender_name: null })
        const anonymous = { ...body, name: "" }
        const input = {
            ...item(null),
            proposal: {
                summary: "API",
                fields: {
                    public_api_lead: publicLeadMetadata(inboundId, null, anonymous),
                },
            },
        }

        await complete(service, input, "lead-1")

        expect(fulfillment.applyDetails.mock.calls[0]?.[2]).toEqual({ ...anonymous, company: "", needSupplied: false })
    })

    it("rolls back the completion receipt and does not link the customer when detail settlement fails", async () => {
        const { service, tx, fulfillment } = await build()
        fulfillment.applyDetails.mockRejectedValue(new PublicApiError({ code: PublicApiErrorCode.NotWritten }))

        await expect(complete(service, item(), "lead-1")).rejects.toThrow(PublicApiErrorCode.NotWritten)

        expect(tx.outcomes).toEqual(["rollback"])
        expect(tx.em.update).not.toHaveBeenCalled()
    })
})

describe("PublicLeadCompletionService approved facts", () => {
    it("keeps the person's edited customer facts from capture rather than restoring the admitted need and company", async () => {
        const { service, fulfillment } = await build()
        const input = item()
        const approved = { summary: "Edited", fields: { company: "Approved company", need: "Approved need" } }

        await service.complete(ctx, input, "lead-1", approved, false)

        expect(fulfillment.applyDetails.mock.calls[0]?.[2]).toEqual(capturedDetails)
    })

    it.each([
        [true, "Created through the API", true],
        [false, "Created through the API", false],
        [undefined, "Created through the API", false],
        [undefined, "", false],
        [undefined, "Original need", true],
    ] as const)(
        "settles a late customer match with reviewed facts and original need presence: %p, %p",
        async (needSupplied, need, expected) => {
            const payload = { ...body, need, ...(needSupplied === undefined ? {} : { needSupplied }) }
            if (needSupplied === undefined) delete payload.needSupplied
            const { service, fulfillment } = await build([{ ...row, payload, needSupplied: needSupplied ?? null }])
            const approved = { summary: "Edited", fields: { company: "Approved company", need: "Approved need" } }

            await service.complete(ctx, item(), "lead-1", approved, true)

            expect(fulfillment.applyDetails.mock.calls[0]?.[2]).toEqual({
                ...payload,
                company: "Approved company",
                need: "Approved need",
                needSupplied: expected,
            })
        },
    )

    it("keeps missing approved facts empty rather than restoring the admitted values", async () => {
        const { service, fulfillment } = await build()

        await service.complete(ctx, item(), "lead-1", { summary: "Edited", fields: {} }, true)

        expect(fulfillment.applyDetails.mock.calls[0]?.[2]).toEqual({ ...body, company: "", need: "" })
    })
})
