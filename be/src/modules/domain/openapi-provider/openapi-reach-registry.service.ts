import { Injectable } from "@nestjs/common"
import { ProviderRegistryService } from "@modules/domain/provider-registry"
import type { OpenApiReachPort } from "./openapi-reach.contracts"

@Injectable()
/** How API accounts are reached: the OpenAPI provider's live reach (its real host) and its sandbox twin, picked per account by `portFor`. */
export class OpenApiReachRegistryService extends ProviderRegistryService<OpenApiReachPort> {}
