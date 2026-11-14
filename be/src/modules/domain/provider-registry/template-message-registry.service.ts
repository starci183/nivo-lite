import { Injectable } from "@nestjs/common"
import { ProviderRegistryService } from "./provider-registry.service"
import type { TemplateMessagePort } from "./template-message-ports.contracts"

@Injectable()
/** The providers that send a template message to a phone number (a delivery kind behind the one customer send). */
export class TemplateMessageRegistryService extends ProviderRegistryService<TemplateMessagePort> {}
