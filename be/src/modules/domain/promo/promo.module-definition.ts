import { ConfigurableModuleBuilder } from "@nestjs/common"

/** The promo capability has no runtime options; the app chooses its visibility. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<Record<never, never>>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
