import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { PromoOptions } from "./promo.options"

/** The promo capability has no runtime options; the app chooses its visibility. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<PromoOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
