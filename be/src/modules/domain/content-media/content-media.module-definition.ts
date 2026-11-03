import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ContentMediaOptions } from "./content-media.options"

/** The content-media module base; the app root decides whether it is global. */
const definition = new ConfigurableModuleBuilder<ContentMediaOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ContentMediaOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ContentMediaOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
