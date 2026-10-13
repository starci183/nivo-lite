import { QueryHandler } from "@nestjs/cqrs"
import { PaymentOrderRequestsService } from "@modules/domain/payment-order-requests"
import type { PaymentOrderRequestStatusLookup } from "@modules/domain/payment-order-requests"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { PaymentOrderRequestStatusQuery } from "./payment-order-request-status.query"

@QueryHandler(PaymentOrderRequestStatusQuery)
/** Reads the selected request through the caller-authorized domain service. */
export class PaymentOrderRequestStatusHandler extends ICQRSHandler<
    PaymentOrderRequestStatusQuery,
    PaymentOrderRequestStatusLookup
> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly requests: PaymentOrderRequestsService,
    ) {
        super(logger)
    }

    protected override process(query: PaymentOrderRequestStatusQuery): Promise<PaymentOrderRequestStatusLookup> {
        return this.requests.status(
            query.params.principal.id,
            query.params.request.workspaceId,
            query.params.request.id,
        )
    }
}
