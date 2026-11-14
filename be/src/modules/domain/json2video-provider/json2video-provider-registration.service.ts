import { Injectable, type OnModuleInit } from "@nestjs/common"
import { SandboxCatalogueRegistryService } from "@modules/domain/provider-sandbox"
import { VideoComposeRegistryService } from "@modules/domain/video-compose"
import { Json2VideoComposeService } from "./json2video-compose.service"
import { JSON2VIDEO_SANDBOX_CATALOGUE } from "./json2video-sandbox.catalogue"
import { Json2VideoSandboxComposeService } from "./json2video-sandbox-compose.service"

@Injectable()
/** Hands what JSON2Video can do for core to the compose registry, once, when the app starts. */
export class Json2VideoProviderRegistrationService implements OnModuleInit {
    constructor(
        private readonly composers: VideoComposeRegistryService,
        private readonly compose: Json2VideoComposeService,
        private readonly composeSandbox: Json2VideoSandboxComposeService,
        private readonly catalogues: SandboxCatalogueRegistryService,
    ) {}

    /** Registers the compose port. */
    onModuleInit(): void {
        this.composers.register({ live: this.compose, sandbox: this.composeSandbox })
        this.catalogues.register(JSON2VIDEO_SANDBOX_CATALOGUE)
    }
}
