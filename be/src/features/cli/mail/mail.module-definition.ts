import { defineConfigurableModule } from "@starci/nest-kit"
import type { MailCliOptions } from "./mail.options"

/** The configurable-module base of the mail cli module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<MailCliOptions>()
