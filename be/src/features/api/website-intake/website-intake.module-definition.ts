import { defineConfigurableModule } from "@starci/nest-kit"
import type { WebsiteIntakeApiOptions } from "./website-intake.options"

/** The configurable-module base of the website intake module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<WebsiteIntakeApiOptions>()
