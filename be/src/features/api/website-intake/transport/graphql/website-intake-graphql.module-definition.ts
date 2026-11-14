import { defineConfigurableModule } from "@starci/nest-kit"
import type { WebsiteIntakeGraphqlOptions } from "./website-intake-graphql.options"

/** The configurable-module base of the website-intake-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<WebsiteIntakeGraphqlOptions>()
