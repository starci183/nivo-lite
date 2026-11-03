import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { AvatarsOptions } from "./avatars.options"

/** The avatars module base; the app root decides whether it is global. */
const definition = new ConfigurableModuleBuilder<AvatarsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    AvatarsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: AvatarsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
