import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { VIDEO_ASSETS } from "@modules/domain/video"
import { SUPABASE_STORAGE } from "@modules/integrations/supabase"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./video-assets-binding.module-definition"

@Module({})
/** Binds the render file store to the existing Supabase storage integration. */
export class VideoAssetsBindingModule extends ConfigurableModuleClass {
    /** Registers the alias with visibility chosen by the composition root. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: VIDEO_ASSETS, useExisting: SUPABASE_STORAGE }],
            exports: [VIDEO_ASSETS],
        }
    }
}
