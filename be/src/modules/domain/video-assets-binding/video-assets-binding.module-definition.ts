import { ConfigurableModuleBuilder } from "@nestjs/common"

/** The app chooses visibility of the video file-store alias. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<Record<never, never>>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
