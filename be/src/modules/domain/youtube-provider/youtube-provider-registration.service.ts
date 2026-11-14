import { Injectable, type OnModuleInit } from "@nestjs/common"
import { YoutubePublishRegistryService } from "@modules/domain/provider-registry"
import { SandboxCatalogueRegistryService } from "@modules/domain/provider-sandbox"
import { YOUTUBE_SANDBOX_CATALOGUE } from "./youtube-sandbox.catalogue"
import { YoutubeSandboxVideoService } from "./youtube-sandbox-video.service"
import { YoutubeVideoService } from "./youtube-video.service"

@Injectable()
/**
 * Hands what the Google account can publish to the registry that asks for it, once, when the app starts: the YouTube destination, with
 * its live port and its sandbox twin, and the hardcoded sandbox catalogue (added to the Google account's other cases: one provider key).
 */
export class YoutubeProviderRegistrationService implements OnModuleInit {
    constructor(
        private readonly registry: YoutubePublishRegistryService,
        private readonly video: YoutubeVideoService,
        private readonly videoSandbox: YoutubeSandboxVideoService,
        private readonly catalogues: SandboxCatalogueRegistryService,
    ) {}

    /** Hands the destination to its registry, live and sandbox, and registers the catalogue. */
    onModuleInit(): void {
        this.registry.register({ live: this.video, sandbox: this.videoSandbox })
        const ids = new Set(YOUTUBE_SANDBOX_CATALOGUE.cases.map((one) => one.id))
        const others = this.catalogues.casesOf(YOUTUBE_SANDBOX_CATALOGUE.provider).filter((one) => !ids.has(one.id))
        this.catalogues.register({ provider: YOUTUBE_SANDBOX_CATALOGUE.provider, cases: [...others, ...YOUTUBE_SANDBOX_CATALOGUE.cases] })
    }
}
