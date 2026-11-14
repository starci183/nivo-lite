import { Injectable, type OnModuleInit } from "@nestjs/common"
import { SandboxCatalogueRegistryService } from "@modules/domain/provider-sandbox"
import { CASSO_SANDBOX_CATALOGUE } from "./casso-sandbox.catalogue"

@Injectable()
/**
 * Hands Casso's sandbox catalogue to the catalogue registry, once, when the app starts. Casso is WEBHOOK-ONLY in NIVO (its webhook door
 * registers itself in the app that receives it; there is no live poller, transaction list or payment instruction), so there is nothing
 * else to register with a sandbox twin.
 */
export class CassoProviderRegistrationService implements OnModuleInit {
    constructor(private readonly catalogues: SandboxCatalogueRegistryService) {}

    /** Registers the Casso sandbox catalogue. */
    onModuleInit(): void {
        this.catalogues.register(CASSO_SANDBOX_CATALOGUE)
    }
}
