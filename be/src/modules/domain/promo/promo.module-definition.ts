import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { PromoOptions } from "./promo.options"

/** The promo capability has no runtime options; the app chooses its visibility. */
const definition = new ConfigurableModuleBuilder<PromoOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    PromoOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: PromoOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
