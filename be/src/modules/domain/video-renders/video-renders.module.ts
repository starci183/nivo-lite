import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./video-renders.module-definition"
import { VideoRendersService } from "./video-renders.service"

@Module({})
/** The video-renders capability over the primary Supabase PostgreSQL connection: the render rows the render job produces. */
export class VideoRendersModule extends ConfigurableModuleClass {
    /** Registers the capability once in the app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return { ...base, providers: [...(base.providers ?? []), VideoRendersService], exports: [VideoRendersService] }
    }
}
