import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import type { InboundEventRecordsOptions } from "./inbound-event-records.options"

/** The configurable-module base of the inbound event ledger. */
const definition = new ConfigurableModuleBuilder<InboundEventRecordsOptions>().setClassMethodName("register").build()
export const ConfigurableModuleClass: ConfigurableModuleCls<InboundEventRecordsOptions, "register", "create"> =
    definition.ConfigurableModuleClass
export const MODULE_OPTIONS_TOKEN: string | symbol = definition.MODULE_OPTIONS_TOKEN
export const OPTIONS_TYPE: InboundEventRecordsOptions = definition.OPTIONS_TYPE
