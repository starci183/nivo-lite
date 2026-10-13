import { Injectable } from "@nestjs/common"
import type { PaymentReceipts } from "./work-engine.port"

@Injectable()
/** The payment receipt trigger of an app whose automations lane has not landed. */
export class UnboundPaymentReceiptsService implements PaymentReceipts {
    /** Triggers nothing. */
    receiptFor(): Promise<void> {
        return Promise.resolve()
    }
}
