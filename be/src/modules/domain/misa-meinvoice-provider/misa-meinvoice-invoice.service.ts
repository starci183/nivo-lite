import { PROVIDER } from "@nivo-lite/agent-sdk/names"
import { Injectable } from "@nestjs/common"
import type { ConnectionRecord } from "@modules/domain/connections"
import {
    providerRefusal,
    withProof,
    type InvoiceIssuePort,
    type InvoiceIssueRequest,
    type IssuedInvoice,
} from "@modules/domain/provider-registry"
import {
    InjectMisaMeinvoice,
    MisaMeinvoiceError,
    MisaMeinvoiceErrorCode,
    type MisaMeinvoiceClient,
} from "@modules/integrations/misa-meinvoice"
import { DomainError } from "@modules/platform/errors"

/** The provider key of MISA meInvoice, as the connector catalogue lists it. */
export const MISA_MEINVOICE_PROVIDER: typeof PROVIDER.misaMeinvoice = PROVIDER.misaMeinvoice

/** A failure of the meInvoice client as the generic port throws it: an operation not built is `not_available`, proving nothing left. */
export const misaMeinvoiceFailureOf = (cause: unknown): unknown =>
    cause instanceof MisaMeinvoiceError && cause.code === MisaMeinvoiceErrorCode.NotAvailable
        ? withProof(providerRefusal(MISA_MEINVOICE_PROVIDER, "not_available", String(cause.params.operation), cause), "not_sent")
        : cause

@Injectable()
/**
 * MISA meInvoice as the adapter of the generic e-invoice issue purpose (`InvoiceIssuePort`, `nivo.tool.invoice.create`). Its
 * integration documentation could not be read (`MISA_MEINVOICE_OPERATIONS`), so `issue` refuses `not_available` and sends nothing.
 */
export class MisaMeinvoiceInvoiceService implements InvoiceIssuePort {
    /** The provider key. */
    readonly provider: string = MISA_MEINVOICE_PROVIDER

    constructor(@InjectMisaMeinvoice() private readonly client: MisaMeinvoiceClient) {}

    /** Issues one invoice: docs-missing (operation `invoice.publish`), refused `not_available`. */
    async issue(_connection: ConnectionRecord, _request: InvoiceIssueRequest): Promise<IssuedInvoice> {
        try {
            return await this.client.publishInvoice()
        } catch (cause) {
            const failure = misaMeinvoiceFailureOf(cause)
            if (failure instanceof DomainError) throw failure
            throw cause
        }
    }
}
