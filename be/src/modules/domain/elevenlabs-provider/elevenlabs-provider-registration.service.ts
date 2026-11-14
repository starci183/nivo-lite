import { Injectable, type OnModuleInit } from "@nestjs/common"
import { DubbingRegistryService, ProviderFileRegistryService, SpeechRegistryService } from "@modules/domain/provider-registry"
import { ElevenLabsMediaService } from "./elevenlabs-media.service"

@Injectable()
/** Hands what ElevenLabs can do for core to the registries that ask for it, once, when the app starts: speech, dubbing and its files. */
export class ElevenLabsProviderRegistrationService implements OnModuleInit {
    constructor(
        private readonly speech: SpeechRegistryService,
        private readonly dubbing: DubbingRegistryService,
        private readonly files: ProviderFileRegistryService,
        private readonly media: ElevenLabsMediaService,
    ) {}

    /** Hands each capability to its registry. */
    onModuleInit(): void {
        this.speech.register(this.media)
        this.dubbing.register(this.media)
        this.files.register(this.media)
    }
}
