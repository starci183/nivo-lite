import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { BankFeedService, BankFeedDeliveryService } from "@modules/domain/billing"
import { JOB_CLAIMS } from "@modules/platform/jobs"
import type { JobClaims } from "@modules/platform/jobs"

/** Arranges the actual domain coordinator and a recorder for the downstream receipt effect. */
export const bankFeedDomainBuilder = async (claims: JobClaims) => {
    const inbox = mock<BankFeedService>()
    inbox.processRecordedFeedDelivery.mockResolvedValue(undefined)
    const billing = await Test.createTestingModule({
        providers: [
            BankFeedDeliveryService,
            { provide: BankFeedService, useValue: inbox },
            { provide: JOB_CLAIMS, useValue: claims },
        ],
    }).compile()
    return { inbox, service: billing.get(BankFeedDeliveryService), close: () => billing.close() }
}
