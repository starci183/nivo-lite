import { Module, type DynamicModule } from "@nestjs/common"
import { ElevenLabsClient } from "./elevenlabs.client"
import { ELEVENLABS } from "./elevenlabs.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./elevenlabs.module-definition"

@Module({})
/** Provides the ElevenLabs client. */
export class ElevenLabsModule extends ConfigurableModuleClass {
    /** Registers the integration once per app that calls ElevenLabs. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: ELEVENLABS, useClass: ElevenLabsClient }],
            exports: [ELEVENLABS],
        }
    }
}
