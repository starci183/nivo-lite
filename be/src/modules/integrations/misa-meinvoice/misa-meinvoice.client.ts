import { Injectable } from "@nestjs/common"
import { MisaMeinvoiceError, MisaMeinvoiceErrorCode } from "./errors/misa-meinvoice.error"
import { MISA_MEINVOICE_OPERATIONS } from "./misa-meinvoice.operations"

/** The refusal of an operation that is not built: nothing leaves. */
const notAvailable = (operation: string): Promise<never> =>
    Promise.reject(new MisaMeinvoiceError({ code: MisaMeinvoiceErrorCode.NotAvailable, params: { operation } }))

@Injectable()
/**
 * The one place that will talk to MISA meInvoice. Its official documentation could not be read (`MISA_MEINVOICE_OPERATIONS`), so no endpoint, parameter
 * or member is invented: every operation is named and refuses `NotAvailable` before any request leaves. When the documentation is read,
 * each method gets its documented request and response here, behind the injected HTTP port, as the other provider clients do.
 */
export class MisaMeinvoiceClient {
    /** The token an integration call is authorised by: docs-missing (`MISA_MEINVOICE_OPERATIONS.authToken`); refuses `NotAvailable` and sends nothing. */
    issueToken(): Promise<never> {
        return notAvailable(MISA_MEINVOICE_OPERATIONS.authToken.api)
    }

    /** Issuing (publishing) one e-invoice: docs-missing (`MISA_MEINVOICE_OPERATIONS.invoicePublish`); refuses `NotAvailable` and sends nothing. */
    publishInvoice(): Promise<never> {
        return notAvailable(MISA_MEINVOICE_OPERATIONS.invoicePublish.api)
    }

    /** The state of an issued invoice: docs-missing (`MISA_MEINVOICE_OPERATIONS.invoiceStatusGet`); refuses `NotAvailable` and sends nothing. */
    invoiceStatus(): Promise<never> {
        return notAvailable(MISA_MEINVOICE_OPERATIONS.invoiceStatusGet.api)
    }

    /** The PDF / XML of an issued invoice: docs-missing (`MISA_MEINVOICE_OPERATIONS.invoiceDownload`); refuses `NotAvailable` and sends nothing. */
    downloadInvoice(): Promise<never> {
        return notAvailable(MISA_MEINVOICE_OPERATIONS.invoiceDownload.api)
    }

    /** Cancelling an issued invoice: docs-missing (`MISA_MEINVOICE_OPERATIONS.invoiceCancel`); refuses `NotAvailable` and sends nothing. */
    cancelInvoice(): Promise<never> {
        return notAvailable(MISA_MEINVOICE_OPERATIONS.invoiceCancel.api)
    }
}
