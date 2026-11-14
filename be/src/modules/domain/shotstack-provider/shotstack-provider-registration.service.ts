import { Injectable, type OnModuleInit } from "@nestjs/common"
import { SandboxCatalogueRegistryService } from "@modules/domain/provider-sandbox"
import { VideoComposeRegistryService } from "@modules/domain/video-compose"
import { ShotstackComposeService } from "./shotstack-compose.service"
import { SHOTSTACK_SANDBOX_CATALOGUE } from "./shotstack-sandbox.catalogue"
import { ShotstackSandboxComposeService } from "./shotstack-sandbox-compose.service"

@Injectable()
/** Hands Shotstack's compose port to the compose registry, once, when the app starts. */
export class ShotstackProviderRegistrationService implements OnModuleInit {
    constructor(
        private readonly registry: VideoComposeRegistryService,
        private readonly compose: ShotstackComposeService,
        private readonly composeSandbox: ShotstackSandboxComposeService,
        private readonly catalogues: SandboxCatalogueRegistryService,
    ) {}

    /** Registers the port. */
    onModuleInit(): void {
        this.registry.register({ live: this.compose, sandbox: this.composeSandbox })
        this.catalogues.register(SHOTSTACK_SANDBOX_CATALOGUE)
    }
}
