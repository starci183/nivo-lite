import { defineCapabilityModule } from "@starci/nest-kit"
import { MAIL_OPTIONS } from "./mail.decorators"
import type { MailOptions } from "./mail.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } = defineCapabilityModule<MailOptions>({
    optionsInjectionToken: MAIL_OPTIONS,
})
