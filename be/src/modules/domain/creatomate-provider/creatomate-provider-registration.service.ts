import { Injectable, type OnModuleInit } from "@nestjs/common"
import { VideoComposeRegistryService } from "@modules/domain/video-compose"
import { CreatomateComposeService } from "./creatomate-compose.service"

@Injectable()
/** Hands the compose port of Creatomate to the compose registry, once, when the app starts. */
export class CreatomateProviderRegistrationService implements OnModuleInit {
    constructor(
        private readonly registry: VideoComposeRegistryService,
        private readonly compose: CreatomateComposeService,
    ) {}

    /** Registers the port under `creatomate`. */
    onModuleInit(): void {
        this.registry.register(this.compose)
    }
}
