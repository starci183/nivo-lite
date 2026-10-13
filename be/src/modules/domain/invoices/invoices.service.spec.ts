import { Test } from "@nestjs/testing"
import { FakeClock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { InvoicesService } from "./invoices.service"
import type { InvoiceRow } from "./persistence/invoices.rows"
import { FIND_INVOICE, FIND_LATEST_LEAD_INVOICE } from "./persistence/invoices.sql"

const WS = "11111111-1111-4111-8111-111111111111"
const INVOICE: InvoiceRow = {
    id: "inv-1",
    workspace_id: WS,
    order_id: "o1",
    lead_id: "l1",
    invoice_no: "HD-01",
    amount_vnd: 50_000,
    status: "issued",
    origin: "live",
    issued_by: null,
    paid_at: null,
}

const build = async (em: MockEntityManager): Promise<InvoicesService> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            InvoicesService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock("2026-10-13T10:00:00.000Z") },
        ],
    }).compile()
    return moduleRef.get(InvoicesService)
}

describe("InvoicesService", () => {
    it("finds the customer's newest open invoice", async () => {
        const service = await build(mockEntityManager({ query: [FIND_LATEST_LEAD_INVOICE, [INVOICE]] }))
        await expect(service.latestOfLead(WS, "l1", "issued")).resolves.toEqual(INVOICE)
    })

    it("answers null when the customer has no invoice in that state", async () => {
        const service = await build(mockEntityManager({ query: [FIND_LATEST_LEAD_INVOICE, []] }))
        await expect(service.latestOfLead(WS, "l1", "paid")).resolves.toBeNull()
    })

    it("finds one invoice of the workspace", async () => {
        const service = await build(mockEntityManager({ query: [FIND_INVOICE, [INVOICE]] }))
        await expect(service.find(WS, "inv-1")).resolves.toEqual(INVOICE)
    })
})
