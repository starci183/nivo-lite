import { defineCapabilityModule } from "@starci/nest-kit"
import { ACCOUNT_DATA_OPTIONS } from "./account-data.port"
import type { AccountDataOptions } from "./account-data.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<AccountDataOptions>({
    optionsInjectionToken: ACCOUNT_DATA_OPTIONS,
})
