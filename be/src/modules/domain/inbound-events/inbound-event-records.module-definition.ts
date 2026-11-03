import { defineConfigurableModule } from "@starci/nest-kit"
import type { InboundEventRecordsOptions } from "./inbound-event-records.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<InboundEventRecordsOptions>()
