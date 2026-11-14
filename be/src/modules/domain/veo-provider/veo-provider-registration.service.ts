import { Injectable, type OnModuleInit } from "@nestjs/common"
import { ProviderFileRegistryService, VideoGenerationRegistryService } from "@modules/domain/provider-registry"
import { SandboxCatalogueRegistryService } from "@modules/domain/provider-sandbox"
import { VEO_SANDBOX_CATALOGUE } from "./veo-sandbox.catalogue"
import { VeoSandboxVideoService } from "./veo-sandbox-video.service"
import { VeoVideoService } from "./veo-video.service"

@Injectable()
/** Hands what Veo can do for core, live and sandbox, to the registries that ask for it, once, when the app starts: video generation and its files. */
export class VeoProviderRegistrationService implements OnModuleInit {
    constructor(
        private readonly videos: VideoGenerationRegistryService,
        private readonly files: ProviderFileRegistryService,
        private readonly video: VeoVideoService,
        private readonly videoSandbox: VeoSandboxVideoService,
        private readonly catalogues: SandboxCatalogueRegistryService,
    ) {}

    /** Hands each capability to its registry. */
    onModuleInit(): void {
        this.videos.register({ live: this.video, sandbox: this.videoSandbox })
        this.files.register({ live: this.video, sandbox: this.videoSandbox })
        this.catalogues.register(VEO_SANDBOX_CATALOGUE)
    }
}
