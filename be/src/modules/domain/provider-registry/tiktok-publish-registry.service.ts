import { Injectable } from "@nestjs/common"
import { ProviderRegistryService } from "./provider-registry.service"
import type { TiktokPublishPort } from "./tiktok-publish-ports.contracts"

@Injectable()
/** The providers that publish to TikTok (destination domain: tiktok). */
export class TiktokPublishRegistryService extends ProviderRegistryService<TiktokPublishPort> {}
