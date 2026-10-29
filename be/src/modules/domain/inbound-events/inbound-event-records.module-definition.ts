import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { InboundEventRecordsOptions } from "./inbound-event-records.options"

/** The configurable-module base of the inbound event ledger; the app root decides whether it is global. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<InboundEventRecordsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
