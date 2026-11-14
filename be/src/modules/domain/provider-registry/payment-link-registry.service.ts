import { Injectable } from "@nestjs/common"
import { ProviderRegistryService } from "./provider-registry.service"
import type { PaymentLinkPort } from "./payment-link-ports.contracts"

@Injectable()
/** The providers that create hosted payment links (generic purpose `nivo.tool.payment.link.*`). */
export class PaymentLinkRegistryService extends ProviderRegistryService<PaymentLinkPort> {}
