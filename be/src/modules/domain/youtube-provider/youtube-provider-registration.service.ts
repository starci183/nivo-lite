import { Injectable, type OnModuleInit } from "@nestjs/common"
import { YoutubePublishRegistryService } from "@modules/domain/provider-registry"
import { YoutubeVideoService } from "./youtube-video.service"

@Injectable()
/** Hands what the Google account can publish to the registry that asks for it, once, when the app starts: the YouTube destination. */
export class YoutubeProviderRegistrationService implements OnModuleInit {
    constructor(
        private readonly registry: YoutubePublishRegistryService,
        private readonly video: YoutubeVideoService,
    ) {}

    /** Hands the destination to its registry. */
    onModuleInit(): void {
        this.registry.register(this.video)
    }
}
