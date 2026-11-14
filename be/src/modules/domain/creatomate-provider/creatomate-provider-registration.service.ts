import { Injectable, type OnModuleInit } from "@nestjs/common"
import { SandboxCatalogueRegistryService } from "@modules/domain/provider-sandbox"
import { VideoComposeRegistryService } from "@modules/domain/video-compose"
import { CreatomateComposeService } from "./creatomate-compose.service"
import { CREATOMATE_SANDBOX_CATALOGUE } from "./creatomate-sandbox.catalogue"
import { CreatomateSandboxComposeService } from "./creatomate-sandbox-compose.service"

@Injectable()
/** Hands the compose port of Creatomate, live and sandbox, to the compose registry and its catalogue to the sandbox page, once, when the app starts. */
export class CreatomateProviderRegistrationService implements OnModuleInit {
    constructor(
        private readonly registry: VideoComposeRegistryService,
        private readonly compose: CreatomateComposeService,
        private readonly composeSandbox: CreatomateSandboxComposeService,
        private readonly catalogues: SandboxCatalogueRegistryService,
    ) {}

    /** Registers both ports under `creatomate` and the sandbox catalogue. */
    onModuleInit(): void {
        this.registry.register({ live: this.compose, sandbox: this.composeSandbox })
        this.catalogues.register(CREATOMATE_SANDBOX_CATALOGUE)
    }
}
