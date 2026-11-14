import { Injectable, type OnModuleInit } from "@nestjs/common"
import { DomainRegistrarRegistryService } from "@modules/domain/provider-registry"
import { SandboxCatalogueRegistryService } from "@modules/domain/provider-sandbox"
import { InetDomainRegistrarService } from "./inet-domain-registrar.service"
import { InetSandboxRegistrarService } from "./inet-sandbox-registrar.service"
import { INET_SANDBOX_CATALOGUE } from "./inet-sandbox.catalogue"

@Injectable()
/** Hands iNET's domain purposes (live and sandbox) and its sandbox catalogue to the registries that ask for them, once, when the app starts. */
export class InetProviderRegistrationService implements OnModuleInit {
    constructor(
        private readonly registrars: DomainRegistrarRegistryService,
        private readonly registrar: InetDomainRegistrarService,
        private readonly sandboxRegistrar: InetSandboxRegistrarService,
        private readonly catalogues: SandboxCatalogueRegistryService,
    ) {}

    /** Hands the capability (both implementations) to its registry and the catalogue to the sandbox page's registry. */
    onModuleInit(): void {
        this.registrars.register({ live: this.registrar, sandbox: this.sandboxRegistrar })
        this.catalogues.register(INET_SANDBOX_CATALOGUE)
    }
}
