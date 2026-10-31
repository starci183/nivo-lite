import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WORK_PERFORMER_REGISTRY } from "@modules/domain/decisions"
import type { WorkPerformerRegistry } from "@modules/domain/decisions"
import { AccountingPerformersRegistrarService } from "./accounting-performers-registrar.service"
import { ReceivablePaymentPerformerService } from "./receivable-payment-performer.service"
import { SupplierPaymentPerformerService } from "./supplier-payment-performer.service"

describe("AccountingPerformersRegistrarService", () => {
    it("registers the receivable payment and the supplier payment performers at boot", async () => {
        const registry = mock<WorkPerformerRegistry>({ add: jest.fn() })
        const payment = mock<ReceivablePaymentPerformerService>()
        const supplierPayment = mock<SupplierPaymentPerformerService>()
        const moduleRef = await Test.createTestingModule({
            providers: [
                AccountingPerformersRegistrarService,
                { provide: WORK_PERFORMER_REGISTRY, useValue: registry },
                { provide: ReceivablePaymentPerformerService, useValue: payment },
                { provide: SupplierPaymentPerformerService, useValue: supplierPayment },
            ],
        }).compile()

        moduleRef.get(AccountingPerformersRegistrarService).onModuleInit()

        expect(registry.add.mock.calls).toEqual([
            ["record_receivable_payment", payment],
            ["confirm_supplier_payment", supplierPayment],
        ])
    })
})
