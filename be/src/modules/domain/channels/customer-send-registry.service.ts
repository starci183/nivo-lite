import { Injectable } from "@nestjs/common"
import { ProviderRegistryService } from "@modules/domain/provider-registry"
import type { CustomerSendPort } from "./customer-send-ports.contracts"

@Injectable()
/** The messaging providers that send a reply to a customer on one of their accounts, each with its live route and its sandbox twin. */
export class CustomerSendRegistryService extends ProviderRegistryService<CustomerSendPort> {}
