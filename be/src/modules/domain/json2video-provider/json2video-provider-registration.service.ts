import { Injectable, type OnModuleInit } from "@nestjs/common"
import { VideoComposeRegistryService } from "@modules/domain/video-compose"
import { Json2VideoComposeService } from "./json2video-compose.service"

@Injectable()
/** Hands what JSON2Video can do for core to the compose registry, once, when the app starts. */
export class Json2VideoProviderRegistrationService implements OnModuleInit {
    constructor(
        private readonly composers: VideoComposeRegistryService,
        private readonly compose: Json2VideoComposeService,
    ) {}

    /** Registers the compose port. */
    onModuleInit(): void {
        this.composers.register(this.compose)
    }
}
