import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./tts.module-definition"
import { TTS } from "./tts.decorators"
import { TtsClient } from "./tts.client"
import { TtsService } from "./tts.service"

@Module({})
/** The text-to-speech integration: the Edge read-aloud client and the paced, cached voiceover service behind the `Tts` port. */
export class TtsModule extends ConfigurableModuleClass {
    /** Registers the integration once per app that renders videos. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), TtsClient, TtsService, { provide: TTS, useExisting: TtsService }],
            exports: [TTS],
        }
    }
}
