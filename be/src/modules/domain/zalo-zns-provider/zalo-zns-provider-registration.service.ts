import { Injectable, type OnModuleInit } from "@nestjs/common"
import { TemplateMessageRegistryService } from "@modules/domain/provider-registry"
import { SandboxCatalogueRegistryService } from "@modules/domain/provider-sandbox"
import { ZALO_ZNS_SANDBOX_CATALOGUE } from "./zalo-zns-sandbox.catalogue"
import { ZaloZnsSandboxTemplateService } from "./zalo-zns-sandbox-template.service"
import { ZaloZnsTemplateService } from "./zalo-zns-template.service"

@Injectable()
/** Hands ZNS to the registry of template-message providers, once, when the app starts. */
export class ZaloZnsProviderRegistrationService implements OnModuleInit {
    constructor(
        private readonly templates: TemplateMessageRegistryService,
        private readonly zns: ZaloZnsTemplateService,
        private readonly znsSandbox: ZaloZnsSandboxTemplateService,
        private readonly catalogues: SandboxCatalogueRegistryService,
    ) {}

    /** Hands the capability to its registry with its sandbox twin, and the sandbox catalogue to the catalogue registry. */
    onModuleInit(): void {
        this.templates.register({ live: this.zns, sandbox: this.znsSandbox })
        this.catalogues.register(ZALO_ZNS_SANDBOX_CATALOGUE)
    }
}
