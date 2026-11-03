import { defineCapabilityModule } from "@starci/nest-kit"
import { ZALO_INBOX_OPTIONS } from "./zalo-inbox.decorators"
import type { ZaloInboxOptions } from "./zalo-inbox.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<ZaloInboxOptions>({
    optionsInjectionToken: ZALO_INBOX_OPTIONS,
})
