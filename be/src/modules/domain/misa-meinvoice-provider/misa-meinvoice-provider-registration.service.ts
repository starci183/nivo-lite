import { Injectable, type OnModuleInit } from "@nestjs/common"
import { InvoiceIssueRegistryService } from "@modules/domain/provider-registry"
import { MisaMeinvoiceInvoiceService } from "./misa-meinvoice-invoice.service"

@Injectable()
/** Hands the meInvoice issue port to its registry once, when the app starts. */
export class MisaMeinvoiceProviderRegistrationService implements OnModuleInit {
    constructor(
        private readonly invoices: InvoiceIssueRegistryService,
        private readonly invoice: MisaMeinvoiceInvoiceService,
    ) {}

    /** Hands the capability to its registry. */
    onModuleInit(): void {
        this.invoices.register(this.invoice)
    }
}
