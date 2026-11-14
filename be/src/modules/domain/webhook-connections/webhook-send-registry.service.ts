import { Injectable } from "@nestjs/common"
import { ProviderRegistryService } from "@modules/domain/provider-registry"
import type { WebhookSendPort } from "./webhook-send.port"

@Injectable()
/**
 * The outgoing webhook of an account, its live port (the receiver's own address) and its sandbox twin (the hardcoded delivery cases):
 * the wizard's test and the business events' delivery job resolve the port of an ACCOUNT through `portFor`, THE ONE SWITCH.
 */
export class WebhookSendRegistryService extends ProviderRegistryService<WebhookSendPort> {}
