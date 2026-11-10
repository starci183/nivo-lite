import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { IMAGE } from "./image.decorators"
import { ImageClient } from "./image.client"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./image.module-definition"

@Module({})
/** The image integration: the one caller of the image library, behind the `Image` port. */
export class ImageModule extends ConfigurableModuleClass {
    /** Registers the integration once per app that draws pictures. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [...(base.providers ?? []), ImageClient, { provide: IMAGE, useExisting: ImageClient }],
            exports: [IMAGE],
        }
    }
}
