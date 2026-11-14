import { Injectable, type OnModuleInit } from "@nestjs/common"
import { PaymentLinkRegistryService } from "@modules/domain/provider-registry"
import { SandboxCatalogueRegistryService } from "@modules/domain/provider-sandbox"
import { PayosPaymentLinkService } from "./payos-payment-link.service"
import { PAYOS_SANDBOX_CATALOGUE } from "./payos-sandbox.catalogue"
import { PayosSandboxPaymentLinkService } from "./payos-sandbox-payment-link.service"

@Injectable()
/** Hands payOS's payment-link purpose (live and sandbox) to the registry that asks for it, and the sandbox catalogue to the catalogue registry, once, when the app starts. */
export class PayosProviderRegistrationService implements OnModuleInit {
    constructor(
        private readonly links: PaymentLinkRegistryService,
        private readonly link: PayosPaymentLinkService,
        private readonly linkSandbox: PayosSandboxPaymentLinkService,
        private readonly catalogues: SandboxCatalogueRegistryService,
    ) {}

    /** Hands the capability to its registry. */
    onModuleInit(): void {
        this.links.register({ live: this.link, sandbox: this.linkSandbox })
        this.catalogues.register(PAYOS_SANDBOX_CATALOGUE)
    }
}
