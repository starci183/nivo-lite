import { Module, type DynamicModule } from "@nestjs/common"
import { Json2VideoClient } from "./json2video.client"
import { JSON2VIDEO } from "./json2video.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./json2video.module-definition"

@Module({})
/** Provides the JSON2Video client. */
export class Json2VideoModule extends ConfigurableModuleClass {
    /** Registers the integration once per app that calls JSON2Video. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), { provide: JSON2VIDEO, useClass: Json2VideoClient }],
            exports: [JSON2VIDEO],
        }
    }
}
