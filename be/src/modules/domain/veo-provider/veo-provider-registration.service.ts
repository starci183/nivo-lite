import { Injectable, type OnModuleInit } from "@nestjs/common"
import { ProviderFileRegistryService, VideoGenerationRegistryService } from "@modules/domain/provider-registry"
import { VeoVideoService } from "./veo-video.service"

@Injectable()
/** Hands what Veo can do for core to the registries that ask for it, once, when the app starts: video generation and its files. */
export class VeoProviderRegistrationService implements OnModuleInit {
    constructor(
        private readonly videos: VideoGenerationRegistryService,
        private readonly files: ProviderFileRegistryService,
        private readonly video: VeoVideoService,
    ) {}

    /** Hands each capability to its registry. */
    onModuleInit(): void {
        this.videos.register(this.video)
        this.files.register(this.video)
    }
}
