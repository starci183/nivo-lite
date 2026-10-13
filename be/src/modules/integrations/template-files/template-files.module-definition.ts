import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { TemplateFilesOptions } from "./template-files.options"

/** The configurable-module base of the template files integration. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<TemplateFilesOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
