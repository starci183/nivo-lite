import { Injectable } from "@nestjs/common"
import { MisaAmisError, MisaAmisErrorCode } from "./errors/misa-amis.error"
import { MISA_AMIS_OPERATIONS } from "./misa-amis.operations"

/** The refusal of an operation that is not built: nothing leaves. */
const notAvailable = (operation: string): Promise<never> =>
    Promise.reject(new MisaAmisError({ code: MisaAmisErrorCode.NotAvailable, params: { operation } }))

@Injectable()
/**
 * The one place that will talk to MISA AMIS. Its official documentation could not be read (`MISA_AMIS_OPERATIONS`), so no endpoint, parameter
 * or member is invented: every operation is named and refuses `NotAvailable` before any request leaves. When the documentation is read,
 * each method gets its documented request and response here, behind the injected HTTP port, as the other provider clients do.
 */
export class MisaAmisClient {
    /** The token an integration call is authorised by: docs-missing (`MISA_AMIS_OPERATIONS.authToken`); refuses `NotAvailable` and sends nothing. */
    issueToken(): Promise<never> {
        return notAvailable(MISA_AMIS_OPERATIONS.authToken.api)
    }

    /** Writing one accounting voucher: docs-missing (`MISA_AMIS_OPERATIONS.voucherCreate`); refuses `NotAvailable` and sends nothing. */
    createVoucher(): Promise<never> {
        return notAvailable(MISA_AMIS_OPERATIONS.voucherCreate.api)
    }

    /** Finding a customer or vendor: docs-missing (`MISA_AMIS_OPERATIONS.partnerFind`); refuses `NotAvailable` and sends nothing. */
    findPartner(): Promise<never> {
        return notAvailable(MISA_AMIS_OPERATIONS.partnerFind.api)
    }
}
