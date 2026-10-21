import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { WORK_PERFORMER_REGISTRY } from "@modules/domain/decisions"
import type { WorkPerformerRegistry } from "@modules/domain/decisions"
import { AccountingPerformersRegistrarService } from "./accounting-performers-registrar.service"
import { ReceivablePaymentPerformerService } from "./receivable-payment-performer.service"

describe("AccountingPerformersRegistrarService", () => {
    it("registers the receivable payment performer at boot", async () => {
        const registry = mock<WorkPerformerRegistry>({ add: jest.fn() })
        const payment = mock<ReceivablePaymentPerformerService>()
        const moduleRef = await Test.createTestingModule({
            providers: [
                AccountingPerformersRegistrarService,
                { provide: WORK_PERFORMER_REGISTRY, useValue: registry },
                { provide: ReceivablePaymentPerformerService, useValue: payment },
            ],
        }).compile()

        moduleRef.get(AccountingPerformersRegistrarService).onModuleInit()

        expect(registry.add).toHaveBeenCalledTimes(1)
        const [action, performer] = registry.add.mock.calls[0] ?? []
        expect(action).toBe("record_receivable_payment")
        expect(performer).toBe(payment)
    })
})
