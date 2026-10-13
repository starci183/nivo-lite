import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { EvidenceService, WorkEngineService } from "@modules/domain/decisions"
import type { WorkContext } from "@modules/domain/decisions"
import type { InvoiceRow } from "@modules/domain/invoices"
import { LeadRecordsService } from "@modules/domain/leads"
import { WorkItemsService } from "@modules/domain/work-items"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { PaymentClaimsService } from "./payment-claims.service"

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
    origin: "live",
    issued_by: null,
    paid_at: null,
}
const claim = { inboundEventId: "e2", claim: "da chuyen khoan", channelLabel: "Telegram", conversationId: "c1" }

const build = async (open: { readonly id: string; readonly status: string } | null) => {
    const engine = { runWork: jest.fn().mockResolvedValue({ id: "w9" }) }
    const items = { latestOfKey: jest.fn().mockResolvedValue(open) }
    const evidence = { log: jest.fn().mockResolvedValue(undefined) }
    const leads = { find: jest.fn().mockResolvedValue({ contact_name: "Lan" }) }
    const moduleRef = await Test.createTestingModule({
        providers: [
            PaymentClaimsService,
            { provide: WorkEngineService, useValue: mock<WorkEngineService>(engine) },
            { provide: WorkItemsService, useValue: mock<WorkItemsService>(items) },
            { provide: EvidenceService, useValue: mock<EvidenceService>(evidence) },
            { provide: LeadRecordsService, useValue: mock<LeadRecordsService>(leads) },
            { provide: MESSAGE_CATALOG, useValue: mock<MessageCatalog>(catalog) },
        ],
    }).compile()
    return { claims: moduleRef.get(PaymentClaimsService), engine, evidence }
}

describe("PaymentClaimsService", () => {
    it("opens one check that waits for the owner, with the invoice as the single candidate", async () => {
        const { claims, engine } = await build(null)
        await expect(claims.start(ctx, invoice, claim)).resolves.toEqual({ created: true })
        expect(engine.runWork).toHaveBeenCalledWith(
            ctx,
            expect.objectContaining({
                action: "reconcile_payment",
                dedupeKey: "reconcile_payment:invoice:inv-1",
                forceAsk: "unclear_outcome",
                seed: expect.objectContaining({ candidates: [expect.objectContaining({ id: "inv-1" })] }),
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
})
