import { Injectable, type OnModuleInit } from "@nestjs/common"
import { SandboxCatalogueRegistryService } from "@modules/domain/provider-sandbox"
import { OPENAPI_SANDBOX_CATALOGUE } from "./openapi-sandbox.catalogue"

@Injectable()
/**
 * Hands the OpenAPI provider's sandbox catalogue to the catalogue registry, once, when the app starts. The reach itself is registered
 * `{ live, sandbox }` where its live twin lives (the app that makes outbound calls: the native tools), on `OpenApiReachRegistryService`.
 */
export class OpenApiProviderRegistrationService implements OnModuleInit {
    constructor(private readonly catalogues: SandboxCatalogueRegistryService) {}

    /** Registers the OpenAPI sandbox catalogue. */
    onModuleInit(): void {
        this.catalogues.register(OPENAPI_SANDBOX_CATALOGUE)
    }
}
