import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./video-delegations.module-definition"
import { VideoDelegationsService } from "./video-delegations.service"

@Module({})
/** The record of the scripts other agents delegate to AI Editor, imported by the video capability. */
export class VideoDelegationsModule extends ConfigurableModuleClass {
    /** Registers the primary-database delegation owner inside the video capability. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), VideoDelegationsService],
            exports: [VideoDelegationsService],
        }
    }
}
