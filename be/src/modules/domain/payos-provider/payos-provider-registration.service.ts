import { Injectable, type OnModuleInit } from "@nestjs/common"
import { PaymentLinkRegistryService } from "@modules/domain/provider-registry"
import { PayosPaymentLinkService } from "./payos-payment-link.service"

@Injectable()
/** Hands payOS's payment-link purpose to the registry that asks for it, once, when the app starts. */
export class PayosProviderRegistrationService implements OnModuleInit {
    constructor(
        private readonly links: PaymentLinkRegistryService,
        private readonly link: PayosPaymentLinkService,
    ) {}

    /** Hands the capability to its registry. */
    onModuleInit(): void {
        this.links.register(this.link)
    }
}
