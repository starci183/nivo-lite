import { defineCapabilityModule } from "@starci/nest-kit"
import type { MailOptions } from "./mail.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<MailOptions>()
