import { defineCapabilityModule } from "@starci/nest-kit"
import type { ContactsOptions } from "./contacts.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ContactsOptions>()
