import { Injectable, type OnModuleInit } from "@nestjs/common"
import { TiktokPublishRegistryService } from "@modules/domain/provider-registry"
import { TiktokVideoService } from "./tiktok-video.service"

@Injectable()
/** Hands what TikTok can do for core to the registry that asks for it, once, when the app starts: publishing to TikTok. */
export class TiktokProviderRegistrationService implements OnModuleInit {
    constructor(
        private readonly publishers: TiktokPublishRegistryService,
        private readonly video: TiktokVideoService,
    ) {}

    /** Hands the capability to its registry. */
    onModuleInit(): void {
        this.publishers.register(this.video)
    }
}
