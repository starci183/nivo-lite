import { Injectable, type OnModuleInit } from "@nestjs/common"
import { DubbingRegistryService, ProviderFileRegistryService, SpeechRegistryService } from "@modules/domain/provider-registry"
import { SandboxCatalogueRegistryService } from "@modules/domain/provider-sandbox"
import { ElevenLabsMediaService } from "./elevenlabs-media.service"
import { ELEVENLABS_SANDBOX_CATALOGUE } from "./elevenlabs-sandbox.catalogue"
import { ElevenLabsSandboxMediaService } from "./elevenlabs-sandbox-media.service"

@Injectable()
/** Hands what ElevenLabs can do for core, live and sandbox, to the registries that ask for it, once, when the app starts: speech, dubbing and its files. */
export class ElevenLabsProviderRegistrationService implements OnModuleInit {
    constructor(
        private readonly speech: SpeechRegistryService,
        private readonly dubbing: DubbingRegistryService,
        private readonly files: ProviderFileRegistryService,
        private readonly media: ElevenLabsMediaService,
        private readonly mediaSandbox: ElevenLabsSandboxMediaService,
        private readonly catalogues: SandboxCatalogueRegistryService,
    ) {}

    /** Hands each capability to its registry. */
    onModuleInit(): void {
        this.speech.register({ live: this.media, sandbox: this.mediaSandbox })
        this.dubbing.register({ live: this.media, sandbox: this.mediaSandbox })
        this.files.register({ live: this.media, sandbox: this.mediaSandbox })
        this.catalogues.register(ELEVENLABS_SANDBOX_CATALOGUE)
    }
}
