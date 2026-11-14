import { Injectable, type OnModuleInit } from "@nestjs/common"
import { VideoComposeRegistryService } from "@modules/domain/video-compose"
import { ShotstackComposeService } from "./shotstack-compose.service"

@Injectable()
/** Hands Shotstack's compose port to the compose registry, once, when the app starts. */
export class ShotstackProviderRegistrationService implements OnModuleInit {
    constructor(
        private readonly registry: VideoComposeRegistryService,
        private readonly compose: ShotstackComposeService,
    ) {}

    /** Registers the port. */
    onModuleInit(): void {
        this.registry.register(this.compose)
    }
}
