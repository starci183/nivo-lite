import { Test } from "@nestjs/testing"
import { builder, fakeInbox, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import { EventsService } from "@modules/domain/events"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { PaymentReconciledPayload } from "@modules/events/api"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { INBOX } from "@modules/platform/inbox"
import { renewedContract } from "@tests/fixtures/builders/reconcile-payment-performer.builder"
import { ContractRenewalService } from "./contract-renewal.service"
import { ContractsService } from "./contracts.service"

const QUEUE = "payment_reconciled__contracts"

const PAID = {
    dedupeKey: "inv-1",
    workspaceId: "ws-1",
    invoiceId: "inv-1",
    invoiceNo: "INV-202612-0001",
    amountVnd: 450000,
    paidAt: "2026-12-30T10:00:00.000Z",
    transactionId: "tx-1",
    workItemId: "item-1",
    subjectType: "transaction",
    subjectId: "tx-1",
    leadId: "lead-1",
    customer: "Lan",
}
const RENEWAL = { contractId: "contract-1", periodEndsOn: "2027-01-01" }
const paymentOf = builder<PaymentReconciledPayload>({ ...PAID, ...RENEWAL })
const noContractOf = builder<PaymentReconciledPayload>({ ...PAID, periodEndsOn: RENEWAL.periodEndsOn })
const leadlessOf = builder<PaymentReconciledPayload>({
    ...Object.fromEntries(Object.entries(PAID).filter(([name]) => name !== "leadId")),
    ...RENEWAL,
    dedupeKey: PAID.dedupeKey,
    workspaceId: PAID.workspaceId,
    invoiceId: PAID.invoiceId,
    invoiceNo: PAID.invoiceNo,
    workItemId: PAID.workItemId,
    customer: PAID.customer,
})
const noPeriodOf = builder<PaymentReconciledPayload>({ ...PAID, contractId: RENEWAL.contractId })

const build = async () => {
    const tx = fakeTransaction(mockEntityManager())
    const inbox = fakeInbox()
    const contracts = mock<ContractsService>()
    contracts.extendForPaidRenewal.mockResolvedValue({
        extended: true,
        previousEndsOn: "2027-01-01",
        contract: renewedContract,
    })
    const events = mock<EventsService>()
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation((key, params) => `${key}${JSON.stringify(params)}`)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ContractRenewalService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: INBOX, useValue: inbox },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: ContractsService, useValue: contracts },
            { provide: EventsService, useValue: events },
        ],
    }).compile()
    return { service: moduleRef.get(ContractRenewalService), tx, inbox, contracts, events }
}

describe("ContractRenewalService renewForPaidInvoice", () => {
    it("moves the contract of a paid renewal invoice to its next term and records it in one transaction", async () => {
        const { service, tx, inbox, contracts, events } = await build()

        await service.renewForPaidInvoice(QUEUE, "inv-1", paymentOf())

        expect(inbox.claims).toEqual([{ source: QUEUE, eventId: "inv-1" }])
        expect(contracts.extendForPaidRenewal).toHaveBeenCalledWith(
            "ws-1",
            "contract-1",
            "2027-01-01",
            "INV-202612-0001",
            expect.anything(),
        )
        expect(events.record).toHaveBeenCalledWith(
            {
                workspaceId: "ws-1",
                leadId: "lead-1",
                workItemId: "item-1",
                kind: "contract.renewed",
                actor: "NIVO",
                summary: 'contracts.renewedByInvoice{"until":"01/01/2028","no":"INV-202612-0001"}',
                evidence: "2027-01-01 → 2028-01-01",
            },
            expect.anything(),
        )
        expect(tx.commits).toBe(1)
    })

    it("records the renewal of an invoice with no customer on no customer", async () => {
        const { service, events } = await build()

        await service.renewForPaidInvoice(QUEUE, "inv-1", leadlessOf())

        expect(events.record).toHaveBeenCalledWith(expect.objectContaining({ leadId: null }), expect.anything())
    })

    it("records nothing more when the renewal was already applied", async () => {
        const { service, contracts, events } = await build()
        contracts.extendForPaidRenewal.mockResolvedValue({
            extended: false,
            previousEndsOn: "2028-01-01",
            contract: renewedContract,
        })

        await service.renewForPaidInvoice(QUEUE, "inv-1", paymentOf())

        expect(events.record).not.toHaveBeenCalled()
    })

})

describe("ContractRenewalService renewForPaidInvoice refusals", () => {
    it("does nothing for a delivery key it already handled", async () => {
        const { service, inbox, contracts } = await build()
        inbox.seen(QUEUE, "inv-1")

        await service.renewForPaidInvoice(QUEUE, "inv-1", paymentOf())

        expect(contracts.extendForPaidRenewal).not.toHaveBeenCalled()
    })

    it.each([
        ["no contract", noContractOf],
        ["no renewed period", noPeriodOf],
    ])("renews nothing for an invoice with %s", async (_name, unrenewedOf) => {
        const { service, inbox, contracts, tx } = await build()

        await service.renewForPaidInvoice(QUEUE, "inv-1", unrenewedOf())

        expect(contracts.extendForPaidRenewal).not.toHaveBeenCalled()
        expect(inbox.claims).toEqual([])
        expect(tx.outcomes).toEqual([])
    })

    it("releases the claim and leaves the message to be retried when the renewal fails", async () => {
        const { service, tx, contracts } = await build()
        const cause = new Error("contracts down")
        contracts.extendForPaidRenewal.mockRejectedValue(cause)

        await expect(service.renewForPaidInvoice(QUEUE, "inv-1", paymentOf())).rejects.toBe(cause)

        expect(tx.rollbacks).toBe(1)
    })
})
