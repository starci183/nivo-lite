import { Injectable, type OnModuleInit } from "@nestjs/common"
import { TiktokPublishRegistryService } from "@modules/domain/provider-registry"
import { SandboxCatalogueRegistryService } from "@modules/domain/provider-sandbox"
import { TIKTOK_SANDBOX_CATALOGUE } from "./tiktok-sandbox.catalogue"
import { TiktokSandboxVideoService } from "./tiktok-sandbox-video.service"
import { TiktokVideoService } from "./tiktok-video.service"

@Injectable()
/**
 * Hands what TikTok can do for core to the registry that asks for it, once, when the app starts: publishing to TikTok, with its live
 * port and its sandbox twin, and the hardcoded sandbox catalogue.
 */
export class TiktokProviderRegistrationService implements OnModuleInit {
    constructor(
        private readonly publishers: TiktokPublishRegistryService,
        private readonly video: TiktokVideoService,
        private readonly videoSandbox: TiktokSandboxVideoService,
        private readonly catalogues: SandboxCatalogueRegistryService,
    ) {}

    /** Hands the capability to its registry, live and sandbox, and registers the catalogue. */
    onModuleInit(): void {
        this.publishers.register({ live: this.video, sandbox: this.videoSandbox })
        this.catalogues.register(TIKTOK_SANDBOX_CATALOGUE)
    }
}
