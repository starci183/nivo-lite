import { Test } from "@nestjs/testing"
import { mock, type MockOf } from "@starci/jest-preset"
import { BankFeedService, BankFeedDeliveryService } from "@modules/domain/billing"
import { JOB_CLAIMS, type JobClaims } from "@modules/platform/jobs"

type BankFeedDomainBuilderResultShape = {
    inbox: MockOf<BankFeedService>
    service: BankFeedDeliveryService
    close: () => Promise<void>
}

/** Arranges the actual domain coordinator and a recorder for the downstream receipt effect. */
export const bankFeedDomainBuilder = async (claims: JobClaims): Promise<BankFeedDomainBuilderResultShape> => {
    const inbox = mock<BankFeedService>()
    inbox.processRecordedFeedDelivery.mockResolvedValue([])
    const billing = await Test.createTestingModule({
        providers: [
            BankFeedDeliveryService,
            { provide: BankFeedService, useValue: inbox },
            { provide: JOB_CLAIMS, useValue: claims },
        ],
    }).compile()
    return { inbox, service: billing.get(BankFeedDeliveryService), close: () => billing.close() }
}
