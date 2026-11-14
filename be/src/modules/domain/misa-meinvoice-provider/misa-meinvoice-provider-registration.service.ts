import { Injectable, type OnModuleInit } from "@nestjs/common"
import { InvoiceIssueRegistryService } from "@modules/domain/provider-registry"
import { SandboxCatalogueRegistryService } from "@modules/domain/provider-sandbox"
import { MisaMeinvoiceInvoiceService } from "./misa-meinvoice-invoice.service"
import { MISA_MEINVOICE_SANDBOX_CATALOGUE } from "./misa-meinvoice-sandbox.catalogue"
import { MisaMeinvoiceSandboxInvoiceService } from "./misa-meinvoice-sandbox-invoice.service"

@Injectable()
/** Hands the meInvoice issue port (live and sandbox) to its registry, and the sandbox catalogue to the catalogue registry, once, when the app starts. */
export class MisaMeinvoiceProviderRegistrationService implements OnModuleInit {
    constructor(
        private readonly invoices: InvoiceIssueRegistryService,
        private readonly invoice: MisaMeinvoiceInvoiceService,
        private readonly invoiceSandbox: MisaMeinvoiceSandboxInvoiceService,
        private readonly catalogues: SandboxCatalogueRegistryService,
    ) {}

    /** Hands the capability to its registry. */
    onModuleInit(): void {
        this.invoices.register({ live: this.invoice, sandbox: this.invoiceSandbox })
        this.catalogues.register(MISA_MEINVOICE_SANDBOX_CATALOGUE)
    }
}
