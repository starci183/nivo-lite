import { Injectable } from "@nestjs/common"
import { ProviderRegistryService } from "./provider-registry.service"
import type { YoutubePublishPort } from "./youtube-publish-ports.contracts"

@Injectable()
/** The providers that publish to YouTube (destination domain: youtube). */
export class YoutubePublishRegistryService extends ProviderRegistryService<YoutubePublishPort> {}
