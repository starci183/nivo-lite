import { Injectable } from "@nestjs/common"
import { ProviderRegistryService } from "./provider-registry.service"
import type { InstagramPublishPort } from "./instagram-publish-ports.contracts"

@Injectable()
/** The providers that publish to Instagram (destination domain: instagram). */
export class InstagramPublishRegistryService extends ProviderRegistryService<InstagramPublishPort> {}
