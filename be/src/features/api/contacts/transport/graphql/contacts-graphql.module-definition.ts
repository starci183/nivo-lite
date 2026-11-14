import { defineConfigurableModule } from "@starci/nest-kit"
import type { ContactsGraphqlOptions } from "./contacts-graphql.options"

/** The configurable-module base of the contacts-graphql module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = defineConfigurableModule<ContactsGraphqlOptions>()
