import { Injectable } from "@nestjs/common"
import { ProviderRegistryService } from "./provider-registry.service"
import type { FacebookPublishPort } from "./facebook-publish-ports.contracts"

@Injectable()
/** The providers that publish to Facebook Pages (destination domain: facebook). */
export class FacebookPublishRegistryService extends ProviderRegistryService<FacebookPublishPort> {}
