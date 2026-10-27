import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { EvidenceService, WorkEngineService } from "@modules/domain/decisions"
import type { WorkContext, WorkItem } from "@modules/domain/decisions"
import type { InvoiceRow } from "@modules/domain/invoices"
import { LeadRecordsService } from "@modules/domain/leads"
import { WorkItemsService } from "@modules/domain/work-items"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { PaymentClaimsService } from "./payment-claims.service"

const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

const WS = "11111111-1111-4111-8111-111111111111"
const ctx: WorkContext = { workspaceId: WS, actor: "OpenClaw", locale: "vi" }
const catalog: MessageCatalog = { get: (key: string) => key }
const invoice: InvoiceRow = {
    id: "inv-1",
    workspace_id: WS,
    order_id: "o1",
    lead_id: "l1",
    invoice_no: "HD-01",
    amount_vnd: 500_000,
    status: "issued",
    issued_by: null,
    paid_at: null,
    contract_id: null,
    period_ends_on: null,
}
const claim = { inboundEventId: "e2", claim: "da chuyen khoan", channelLabel: "Telegram", conversationId: "c1" }

const build = async (open: { readonly id: string; readonly status: string } | null) => {
    const engine = {
        runWork: jest
            .fn<Promise<WorkItem>, Parameters<WorkEngineService["runWork"]>>()
            .mockResolvedValue(mock<WorkItem>({ id: "w9" })),
    }
    const items = { latestOfKey: jest.fn().mockResolvedValue(open) }
    const evidence = { log: jest.fn().mockResolvedValue(undefined) }
    const leads = { find: jest.fn().mockResolvedValue({ contact_name: "Lan" }) }
    const engineDouble = mock<WorkEngineService>(engine)
    const itemsDouble = mock<WorkItemsService>(items)
    const evidenceDouble = mock<EvidenceService>(evidence)
    const leadsDouble = mock<LeadRecordsService>(leads)
    const catalogDouble = mock<MessageCatalog>(catalog)
    const moduleRef = await Test.createTestingModule({
        providers: [
            PaymentClaimsService,
            { provide: WorkEngineService, useValue: engineDouble },
            { provide: WorkItemsService, useValue: itemsDouble },
            { provide: EvidenceService, useValue: evidenceDouble },
            { provide: LeadRecordsService, useValue: leadsDouble },
            { provide: MESSAGE_CATALOG, useValue: catalogDouble },
        ],
    }).compile()
    return { claims: moduleRef.get(PaymentClaimsService), engine, evidence, items, leads }
}

describe("PaymentClaimsService", () => {
    it("keeps exactly 300 characters of a repeated claim as evidence without reopening its check", async () => {
        const { claims, engine, evidence, items, leads } = await build({ id: "w1", status: "waiting_decision" })
        await expect(claims.start(ctx, invoice, { ...claim, claim: "x".repeat(400) })).resolves.toEqual({
            created: false,
        })
        expect(items.latestOfKey).toHaveBeenCalledWith(WS, "reconcile_payment", "reconcile_payment:invoice:inv-1")
        expect(evidence.log).toHaveBeenCalledWith(ctx, {
            lead_id: "l1",
            work_item_id: "w1",
            kind: "core.duplicate_blocked",
            actor: "NIVO",
            summary: "customerTurns.workDuplicate",
            evidence: "x".repeat(300),
        })
        expect(engine.runWork).not.toHaveBeenCalled()
        expect(leads.find).not.toHaveBeenCalled()
    })

    it("opens one check that waits for the owner, with the invoice as the single candidate", async () => {
        const { claims, engine } = await build(null)
        await expect(claims.start(ctx, invoice, claim)).resolves.toEqual({ created: true })
        expect(engine.runWork).toHaveBeenCalledWith(
            ctx,
            expect.objectContaining({
                action: "reconcile_payment",
                dedupeKey: "reconcile_payment:invoice:inv-1",
                forceAsk: "unclear_outcome",
                seed: objectLike({ candidates: [objectLike({ id: "inv-1" })] }),
            }),
        )
    })

    it("joins the check already open instead of starting another", async () => {
        const { claims, engine, evidence } = await build({ id: "w1", status: "waiting_decision" })
        await expect(claims.start(ctx, invoice, claim)).resolves.toEqual({ created: false })
        expect(engine.runWork).not.toHaveBeenCalled()
        expect(evidence.log).toHaveBeenCalledWith(ctx, expect.objectContaining({ kind: "core.duplicate_blocked" }))
    })

    it("lets the customer claim again after a rejected check", async () => {
        const { claims, engine } = await build({ id: "w1", status: "rejected" })
        await claims.start(ctx, invoice, claim)
        expect(engine.runWork).toHaveBeenCalledWith(
            ctx,
            expect.objectContaining({ dedupeKey: "reconcile_payment:invoice:inv-1:e2" }),
        )
    })

    it("names an invoice with no lead as a dash and still opens the check", async () => {
        const { claims, engine } = await build(null)
        await expect(claims.start(ctx, { ...invoice, lead_id: null }, claim)).resolves.toEqual({ created: true })
        expect(engine.runWork).toHaveBeenCalledWith(
            ctx,
            expect.objectContaining({
                lead_id: null,
                seed: objectLike({
                    summary: "customerTurns.claimSummary",
                    fields: objectLike({ payer: "—" }),
                }),
            }),
        )
    })
})

describe("PaymentClaimsService", () => {
    it("uses a dash when the lead has no contact name", async () => {
        const engine = {
            runWork: jest
                .fn<Promise<WorkItem>, Parameters<WorkEngineService["runWork"]>>()
                .mockResolvedValue(mock<WorkItem>({ id: "w9" })),
        }
        const items = { latestOfKey: jest.fn().mockResolvedValue(null) }
        const evidence = { log: jest.fn() }
        const leads = { find: jest.fn().mockResolvedValue(null) }
        const engineDouble = mock<WorkEngineService>(engine)
        const itemsDouble = mock<WorkItemsService>(items)
        const evidenceDouble = mock<EvidenceService>(evidence)
        const leadsDouble = mock<LeadRecordsService>(leads)
        const catalogDouble = mock<MessageCatalog>(catalog)
        const moduleRef = await Test.createTestingModule({
            providers: [
                PaymentClaimsService,
                { provide: WorkEngineService, useValue: engineDouble },
                { provide: WorkItemsService, useValue: itemsDouble },
                { provide: EvidenceService, useValue: evidenceDouble },
                { provide: LeadRecordsService, useValue: leadsDouble },
                { provide: MESSAGE_CATALOG, useValue: catalogDouble },
            ],
        }).compile()
        const claims = moduleRef.get(PaymentClaimsService)

        await expect(claims.start(ctx, invoice, { ...claim, claim: "x".repeat(600) })).resolves.toEqual({
            created: true,
        })
        expect(leads.find).toHaveBeenCalledWith(WS, "l1")
        const seed = engine.runWork.mock.calls[0]?.[1]?.seed
        expect(seed?.fields?.payer).toBe("—")
        expect(seed?.fields?.claim).toHaveLength(500)
    })

    it("lets the customer claim again after a failed check and keeps the evidence short", async () => {
        const { claims, engine, evidence } = await build({ id: "w1", status: "failed" })
        const long = "y".repeat(400)
        await expect(claims.start(ctx, invoice, { ...claim, claim: long })).resolves.toEqual({ created: true })
        expect(engine.runWork).toHaveBeenCalled()
        expect(evidence.log).not.toHaveBeenCalled()
    })
})
