import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { ContentPillarsOptions } from "./content-pillars.options"

/** Configurable registration of the content-pillars capability. */
const definition = new ConfigurableModuleBuilder<ContentPillarsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    ContentPillarsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: ContentPillarsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
