import { Injectable, type OnModuleInit } from "@nestjs/common"
import { DomainRegistrarRegistryService } from "@modules/domain/provider-registry"
import { SandboxCatalogueRegistryService } from "@modules/domain/provider-sandbox"
import { TinoDomainRegistrarService } from "./tino-domain-registrar.service"
import { TinoSandboxRegistrarService } from "./tino-sandbox-registrar.service"
import { TINO_SANDBOX_CATALOGUE } from "./tino-sandbox.catalogue"

@Injectable()
/** Hands Tino's domain purposes (live and sandbox) and its sandbox catalogue to the registries that ask for them, once, when the app starts. */
export class TinoProviderRegistrationService implements OnModuleInit {
    constructor(
        private readonly registrars: DomainRegistrarRegistryService,
        private readonly registrar: TinoDomainRegistrarService,
        private readonly sandboxRegistrar: TinoSandboxRegistrarService,
        private readonly catalogues: SandboxCatalogueRegistryService,
    ) {}

    /** Hands the capability (both implementations) to its registry and the catalogue to the sandbox page's registry. */
    onModuleInit(): void {
        this.registrars.register({ live: this.registrar, sandbox: this.sandboxRegistrar })
        this.catalogues.register(TINO_SANDBOX_CATALOGUE)
    }
}
