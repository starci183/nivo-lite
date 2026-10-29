import { Test } from "@nestjs/testing"
import { builder, mock, mockEntityManager, recordingEventBus } from "@starci/jest-preset"
import { DurableWorkService, EvidenceService } from "@modules/domain/decisions"
import type { WorkContext, WorkItem } from "@modules/domain/decisions"
import { EVENT_BUS } from "@modules/platform/event-bus"
import { InboundEventsService } from "@modules/domain/inbound-events"
import type { OptionalInboundEvent } from "@modules/domain/inbound-events"
import { LeadRecordsService } from "@modules/domain/leads"
import type { LeadRecordRow } from "@modules/domain/leads"
import { PublicApiErrorCode } from "./errors/public-api.error"
import type { LeadRequestBody, LegacyLeadRequestBody } from "./public-api.contracts"
import { DEFAULT_API_NEED } from "./public-api.policy"
import { PublicLeadFulfillmentService } from "./public-lead-fulfillment.service"

const REQUEST_ID = "10000000-0000-4000-8000-000000000001"
const INBOUND_ID = "20000000-0000-4000-8000-000000000001"
const ctx: WorkContext = { workspaceId: "ws-1", actor: "api:Shop", locale: "en" }
const bodyOf = builder<LeadRequestBody>({
    name: "Mai",
    contact: "84912345678",
    need: "Annual plan",
    channel: "API",
    company: "",
    note: "",
    stage: null,
    externalId: "customer-7",
    source: ctx.actor,
})
const leadOf = builder<LeadRecordRow>({
    id: "lead-1",
    workspace_id: ctx.workspaceId,
    contact_name: "Mai",
    company: "Tea",
    channel: "API",
    need: "Keep this need",
    stage: "new",
    context_summary: null,
    phone: "84912345678",
    email: null,
})
const eventOf = builder<NonNullable<OptionalInboundEvent>>({
    id: INBOUND_ID,
    workspace_id: ctx.workspaceId,
    channel: "manual",
    kind: "lead",
    sender_name: "Mai",
    sender_contact: "84912345678",
    body: DEFAULT_API_NEED,
    amount_vnd: null,
    external_ref: ctx.actor,
    event_id: "api:key:customer-7",
    lead_id: null,
    status: "received",
})
const legacyOf = builder<LegacyLeadRequestBody>({
    inboundEventId: INBOUND_ID,
    keyName: "Shop",
    company: "",
    stage: null,
    note: "",
})
const itemOf = builder<WorkItem>({
    id: "work-1",
    workspace_id: ctx.workspaceId,
    department: "chatbot",
    action: "handoff_lead",
    subject_type: "inbound",
    subject_id: INBOUND_ID,
    lead_id: null,
    inbound_event_id: INBOUND_ID,
    parent_id: null,
    chain_id: "work-1",
    depth: 0,
    status: "queued",
    decided_path: null,
    reason: null,
    reasons: [],
    missing_fields: [],
    proposal: { summary: "Handoff", fields: {} },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    created_at: "2026-10-24T00:00:00Z",
    updated_at: "2026-10-24T00:00:00Z",
    completed_at: null,
    installation_id: null,
})

const build = async () => {
    const inbound = mock<InboundEventsService>()
    inbound.recordInputInTransaction.mockResolvedValue({ duplicate: false, inboundEventId: INBOUND_ID })
    inbound.find.mockResolvedValue(eventOf())
    const leads = mock<LeadRecordsService>()
    leads.match.mockResolvedValue(null)
    leads.applyPublicStage.mockResolvedValue(null)
    const work = mock<DurableWorkService>()
    work.enqueueCommand.mockResolvedValue(itemOf())
    const evidence = mock<EvidenceService>()
    const events = recordingEventBus()
    const tx = mockEntityManager()
    const moduleRef = await Test.createTestingModule({
        providers: [
            PublicLeadFulfillmentService,
            { provide: InboundEventsService, useValue: inbound },
            { provide: LeadRecordsService, useValue: leads },
            { provide: DurableWorkService, useValue: work },
            { provide: EvidenceService, useValue: evidence },
            { provide: EVENT_BUS, useValue: events },
        ],
    }).compile()
    return { service: moduleRef.get(PublicLeadFulfillmentService), inbound, leads, work, evidence, events, tx }
}

describe("PublicLeadFulfillmentService admissions", () => {
    it("commits the original manual input and durable authority handoff without capturing a customer before the gate", async () => {
        const { service, inbound, leads, work, evidence, tx } = await build()
        await expect(service.fulfill(ctx.workspaceId, REQUEST_ID, bodyOf(), tx)).resolves.toBeNull()
        expect(inbound.recordInputInTransaction).toHaveBeenCalledWith(
            {
                workspaceId: ctx.workspaceId,
                channel: "manual",
                kind: "lead",
                senderName: "Mai",
                senderContact: "84912345678",
                body: "Annual plan",
                externalRef: ctx.actor,
                eventId: `api:${REQUEST_ID}`,
            },
            tx,
        )
        expect(work.enqueueCommand.mock.calls[0]?.[0]).toEqual(ctx)
        expect(work.enqueueCommand.mock.calls[0]?.[2]).toBe(tx)
        expect(work.enqueueCommand.mock.calls[0]?.[1]).toMatchObject({
            from: "inbound",
            to: "chatbot",
            command: "handoff_lead",
            inboundEventId: INBOUND_ID,
            dedupeKey: `handoff_lead:inbound:${INBOUND_ID}`,
            payload: {
                subject_type: "inbound",
                subject_id: INBOUND_ID,
                contact_name: "Mai",
                need: "Annual plan",
                channel_label: "API",
                lead_id: null,
                public_api_lead: JSON.stringify({
                    version: 1,
                    completionId: REQUEST_ID,
                    ledgerRequestId: REQUEST_ID,
                    body: bodyOf(),
                }),
            },
        })
        expect(leads.capture).not.toHaveBeenCalled()
        expect(leads.patchPublicFacts).not.toHaveBeenCalled()
        expect(evidence.log).toHaveBeenCalledWith(
            ctx,
            expect.objectContaining({
                kind: "api.lead",
                actor: ctx.actor,
                work_item_id: "work-1",
                lead_id: null,
                evidence: "api:Shop external_id=customer-7",
            }),
            tx,
        )
    })
})

describe("PublicLeadFulfillmentService admission identities", () => {
    it("carries the default need for a new customer and reads an already-resolved durable handoff", async () => {
        const { service, inbound, work, evidence, tx } = await build()
        work.enqueueCommand.mockResolvedValue(itemOf({ lead_id: "lead-2" }))
        await expect(
            service.fulfill(ctx.workspaceId, REQUEST_ID, bodyOf({ need: "", externalId: "" }), tx),
        ).resolves.toBe("lead-2")
        expect(inbound.recordInputInTransaction).toHaveBeenCalledWith(
            expect.objectContaining({ body: DEFAULT_API_NEED }),
            tx,
        )
        expect(work.enqueueCommand.mock.calls[0]?.[0]).toEqual(ctx)
        expect(work.enqueueCommand.mock.calls[0]?.[2]).toBe(tx)
        expect(work.enqueueCommand.mock.calls[0]?.[1]).toMatchObject({
            payload: { need: DEFAULT_API_NEED },
        })
        expect(evidence.log).toHaveBeenCalledWith(ctx, expect.objectContaining({ evidence: ctx.actor }), tx)
    })

    it("refuses an unreadable repeated inbound instead of committing an unlinked admission", async () => {
        const { service, inbound, work, tx } = await build()
        inbound.recordInputInTransaction.mockResolvedValue({ duplicate: true, inboundEventId: "" })
        await expect(service.fulfill(ctx.workspaceId, REQUEST_ID, bodyOf(), tx)).rejects.toMatchObject({
            code: PublicApiErrorCode.RequestInvalid,
        })
        expect(work.enqueueCommand).not.toHaveBeenCalled()
    })

    it("matches the normalized email through the supplied transaction and links an existing customer", async () => {
        const { service, leads, work, tx } = await build()
        leads.match.mockResolvedValue(leadOf())
        await expect(
            service.fulfill(ctx.workspaceId, REQUEST_ID, bodyOf({ contact: "MAI@EXAMPLE.TEST" }), tx),
        ).resolves.toBe("lead-1")
        expect(leads.match).toHaveBeenCalledWith(
            { workspaceId: ctx.workspaceId, phone: null, email: "mai@example.test", name: "Mai", channel: "API" },
            tx,
        )
        expect(work.enqueueCommand.mock.calls[0]?.[0]).toEqual(ctx)
        expect(work.enqueueCommand.mock.calls[0]?.[2]).toBe(tx)
        expect(work.enqueueCommand.mock.calls[0]?.[1]).toMatchObject({
            payload: { lead_id: "lead-1", public_api_lead: undefined },
        })
    })
})

describe("PublicLeadFulfillmentService supplied need", () => {
    it.each([
        [DEFAULT_API_NEED, undefined, null],
        ["", undefined, null],
        ["", true, null],
        ["Annual plan", false, null],
        [DEFAULT_API_NEED, true, DEFAULT_API_NEED],
        ["Annual plan", undefined, "Annual plan"],
        ["Annual plan", true, "Annual plan"],
    ] as const)("applies the owner rule for need=%j, supplied=%j", async (need, needSupplied, expected) => {
        const { service, leads, tx } = await build()
        const body = bodyOf({ need, ...(needSupplied === undefined ? {} : { needSupplied }) })
        await service.applyDetails(ctx, "lead-1", body, tx)
        if (expected === null) expect(leads.patchPublicFacts).not.toHaveBeenCalled()
        else
            expect(leads.patchPublicFacts).toHaveBeenCalledWith(
                { workspaceId: ctx.workspaceId, leadId: "lead-1", company: "", need: expected },
                tx,
            )
    })

    it("patches a supplied company while preserving omitted need and appends the supplied note", async () => {
        const { service, leads, evidence, tx } = await build()
        await service.applyDetails(
            ctx,
            "lead-1",
            bodyOf({ need: DEFAULT_API_NEED, company: "Tea", note: "Call after noon" }),
            tx,
        )
        expect(leads.patchPublicFacts).toHaveBeenCalledWith(
            { workspaceId: ctx.workspaceId, leadId: "lead-1", company: "Tea", need: null },
            tx,
        )
        expect(evidence.log).toHaveBeenCalledWith(ctx, expect.objectContaining({ kind: "api.lead_updated" }), tx)
        expect(evidence.log).toHaveBeenCalledWith(
            ctx,
            expect.objectContaining({ kind: "api.note", evidence: "Call after noon" }),
            tx,
        )
    })
})

describe("PublicLeadFulfillmentService outcomes", () => {
    it("leaves a stage unchanged when the owner rejects an identical stage or reopening a closed deal", async () => {
        const { service, leads, evidence, work, events, tx } = await build()
        await service.applyDetails(ctx, "lead-1", bodyOf({ need: "", stage: "qualified" }), tx)
        expect(leads.applyPublicStage).toHaveBeenCalledWith(ctx.workspaceId, "lead-1", "qualified", tx)
        expect(evidence.log).not.toHaveBeenCalled()
        expect(work.enqueueWork).not.toHaveBeenCalled()
        expect(events.writes).toEqual([])
    })

    it("records a changed open stage without invoice or business event", async () => {
        const { service, leads, evidence, work, events, tx } = await build()
        leads.applyPublicStage.mockResolvedValue(leadOf({ stage: "qualified" }))
        await service.applyDetails(ctx, "lead-1", bodyOf({ need: "", stage: "qualified" }), tx)
        expect(evidence.log).toHaveBeenCalledWith(ctx, expect.objectContaining({ kind: "outcome.recorded" }), tx)
        expect(work.enqueueWork).not.toHaveBeenCalled()
        expect(events.writes).toEqual([])
    })

    it("commits a newly won outcome with gated invoice work and the deduped business event", async () => {
        const { service, leads, work, events, tx } = await build()
        leads.applyPublicStage.mockResolvedValue(leadOf({ stage: "won" }))
        await service.applyDetails(ctx, "lead-1", bodyOf({ need: "", stage: "won" }), tx)
        expect(work.enqueueWork).toHaveBeenCalledWith(
            ctx,
            {
                action: "issue_invoice",
                subject_type: "lead",
                subject_id: "lead-1",
                lead_id: "lead-1",
                dedupeKey: "issue_invoice:lead:lead-1",
                seed: { amount_vnd: null, fields: {} },
            },
            tx,
        )
        expect(events.writes[0]).toMatchObject({
            eventName: "deal_won",
            payload: {
                dedupeKey: "deal.won:lead-1",
                workspaceId: ctx.workspaceId,
                leadId: "lead-1",
                name: "Mai",
                company: "Tea",
                channel: "API",
                need: "Keep this need",
                source: ctx.actor,
            },
        })
    })
})

describe("PublicLeadFulfillmentService historical inline jobs", () => {
    it("keeps a recovered original channel when handing off an unmatched historical customer", async () => {
        const { service, leads, work, tx } = await build()
        await expect(
            service.fulfillExistingInbound(ctx.workspaceId, INBOUND_ID, legacyOf({ channel: "Conference" }), tx),
        ).resolves.toBeNull()
        expect(leads.match).toHaveBeenCalledWith(
            { workspaceId: ctx.workspaceId, phone: "84912345678", email: null, name: "Mai", channel: "Conference" },
            tx,
        )
        expect(work.enqueueCommand.mock.calls[0]?.[0]).toEqual(ctx)
        expect(work.enqueueCommand.mock.calls[0]?.[2]).toBe(tx)
        expect(work.enqueueCommand.mock.calls[0]?.[1]).toMatchObject({
            payload: { channel_label: "Conference" },
        })
    })

    it.each([null, eventOf({ kind: "message" }), eventOf({ channel: "zalo" }), eventOf({ external_ref: "api:Other" })])(
        "refuses an absent or incompatible original inbound: %j",
        async (event) => {
            const { service, inbound, work, tx } = await build()
            inbound.find.mockResolvedValue(event)
            await expect(
                service.fulfillExistingInbound(ctx.workspaceId, INBOUND_ID, legacyOf(), tx),
            ).rejects.toMatchObject({ code: PublicApiErrorCode.RequestInvalid })
            expect(work.enqueueCommand).not.toHaveBeenCalled()
        },
    )
})

describe("PublicLeadFulfillmentService historical linked customers", () => {
    it("reuses a linked customer and the historical input without duplicating admission evidence", async () => {
        const { service, inbound, leads, evidence, work, tx } = await build()
        inbound.find.mockResolvedValue(
            eventOf({ lead_id: "lead-1", sender_name: "Previous name", sender_contact: null }),
        )
        leads.find.mockResolvedValue(leadOf({ contact_name: "Current name", phone: null, channel: "Referral" }))
        await expect(service.fulfillExistingInbound(ctx.workspaceId, INBOUND_ID, legacyOf(), tx)).resolves.toBe(
            "lead-1",
        )
        expect(inbound.find).toHaveBeenCalledWith(ctx.workspaceId, INBOUND_ID, tx)
        expect(leads.find).toHaveBeenCalledWith(ctx.workspaceId, "lead-1", tx)
        expect(leads.match).not.toHaveBeenCalled()
        expect(inbound.recordInputInTransaction).not.toHaveBeenCalled()
        expect(evidence.log).not.toHaveBeenCalled()
        expect(work.enqueueCommand.mock.calls[0]?.[0]).toEqual(ctx)
        expect(work.enqueueCommand.mock.calls[0]?.[2]).toBe(tx)
        expect(work.enqueueCommand.mock.calls[0]?.[1]).toMatchObject({
            inboundEventId: INBOUND_ID,
            dedupeKey: `handoff_lead:inbound:${INBOUND_ID}`,
            payload: { lead_id: "lead-1", channel_label: "Referral" },
        })
    })

    it("refuses an original inbound linked to a customer outside its workspace", async () => {
        const { service, inbound, leads, work, tx } = await build()
        inbound.find.mockResolvedValue(eventOf({ lead_id: "missing" }))
        leads.find.mockResolvedValue(null)
        await expect(service.fulfillExistingInbound(ctx.workspaceId, INBOUND_ID, legacyOf(), tx)).rejects.toMatchObject(
            { code: PublicApiErrorCode.RequestInvalid },
        )
        expect(work.enqueueCommand).not.toHaveBeenCalled()
    })
})

describe("PublicLeadFulfillmentService historical deferred details", () => {
    it("carries new-customer details on the existing input and accepts its already-resolved handoff", async () => {
        const { service, inbound, leads, work, tx } = await build()
        inbound.find.mockResolvedValue(eventOf({ sender_name: null, sender_contact: null }))
        work.enqueueCommand.mockResolvedValue(itemOf({ lead_id: "lead-2" }))
        await expect(
            service.fulfillExistingInbound(
                ctx.workspaceId,
                INBOUND_ID,
                legacyOf({ note: "Follow up", stage: "won", channel: "Partner form" }),
                tx,
            ),
        ).resolves.toBe("lead-2")
        expect(leads.match).toHaveBeenCalledWith(
            { workspaceId: ctx.workspaceId, phone: null, email: null, name: null, channel: "Partner form" },
            tx,
        )
        expect(work.enqueueCommand.mock.calls[0]?.[0]).toEqual(ctx)
        expect(work.enqueueCommand.mock.calls[0]?.[2]).toBe(tx)
        expect(work.enqueueCommand.mock.calls[0]?.[1]).toMatchObject({
            payload: {
                public_api_lead: JSON.stringify({
                    version: 1,
                    completionId: INBOUND_ID,
                    ledgerRequestId: null,
                    body: bodyOf({
                        name: "",
                        contact: null,
                        need: DEFAULT_API_NEED,
                        channel: "Partner form",
                        note: "Follow up",
                        stage: "won",
                        externalId: "",
                    }),
                }),
                need: DEFAULT_API_NEED,
            },
        })
    })
})

describe("PublicLeadFulfillmentService historical contact matching", () => {
    it("matches an unlinked historical customer's normalized contact without fabricating another inbound", async () => {
        const { service, leads, work, tx } = await build()
        leads.match.mockResolvedValue(leadOf({ channel: "Trade show" }))
        await expect(service.fulfillExistingInbound(ctx.workspaceId, INBOUND_ID, legacyOf(), tx)).resolves.toBe(
            "lead-1",
        )
        expect(leads.match).toHaveBeenCalledWith(
            { workspaceId: ctx.workspaceId, phone: "84912345678", email: null, name: null, channel: null },
            tx,
        )
        expect(work.enqueueCommand.mock.calls[0]?.[0]).toEqual(ctx)
        expect(work.enqueueCommand.mock.calls[0]?.[2]).toBe(tx)
        expect(work.enqueueCommand.mock.calls[0]?.[1]).toMatchObject({
            payload: { channel_label: "Trade show" },
        })
        expect(leads.patchPublicFacts).not.toHaveBeenCalled()
    })

    it("resolves a historical customer by normalized email while retaining the known channel", async () => {
        const { service, inbound, leads, tx } = await build()
        inbound.find.mockResolvedValue(eventOf({ sender_contact: " MAI@EXAMPLE.TEST " }))
        leads.match.mockResolvedValue(leadOf({ channel: "Email" }))
        await expect(service.fulfillExistingInbound(ctx.workspaceId, INBOUND_ID, legacyOf(), tx)).resolves.toBe(
            "lead-1",
        )
        expect(leads.match).toHaveBeenCalledWith(
            { workspaceId: ctx.workspaceId, phone: null, email: "mai@example.test", name: null, channel: null },
            tx,
        )
    })
})

describe("PublicLeadFulfillmentService historical recovery refusal", () => {
    it.each([null, "anonymous"])(
        "preserves a contactless historical request without its lost channel: %j",
        async (senderContact) => {
            const { service, inbound, leads, work, evidence, tx } = await build()
            inbound.find.mockResolvedValue(eventOf({ sender_contact: senderContact }))
            await expect(
                service.fulfillExistingInbound(ctx.workspaceId, INBOUND_ID, legacyOf(), tx),
            ).rejects.toMatchObject({
                code: PublicApiErrorCode.RequestInvalid,
                params: { field: "legacyChannel" },
            })
            expect(leads.match).not.toHaveBeenCalled()
            expect(leads.find).not.toHaveBeenCalled()
            expect(work.enqueueCommand).not.toHaveBeenCalled()
            expect(evidence.log).not.toHaveBeenCalled()
            expect(inbound.recordInputInTransaction).not.toHaveBeenCalled()
        },
    )

    it("preserves an unmatched historical contact for channel recovery before any domain effect", async () => {
        const { service, leads, work, evidence, inbound, tx } = await build()
        await expect(service.fulfillExistingInbound(ctx.workspaceId, INBOUND_ID, legacyOf(), tx)).rejects.toMatchObject(
            {
                code: PublicApiErrorCode.RequestInvalid,
                params: { field: "legacyChannel" },
            },
        )
        expect(leads.match).toHaveBeenCalled()
        expect(work.enqueueCommand).not.toHaveBeenCalled()
        expect(leads.patchPublicFacts).not.toHaveBeenCalled()
        expect(evidence.log).not.toHaveBeenCalled()
        expect(inbound.recordInputInTransaction).not.toHaveBeenCalled()
    })
})
