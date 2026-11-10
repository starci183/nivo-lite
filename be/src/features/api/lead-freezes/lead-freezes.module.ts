import { Module } from "@nestjs/common"
import { DecideLeadFreezeHandler } from "./application/decide-lead-freeze.handler"
import { ReadLeadFreezeHandler } from "./application/read-lead-freeze.handler"
import { ConfigurableModuleClass } from "./lead-freezes.module-definition"

@Module({
    providers: [ReadLeadFreezeHandler, DecideLeadFreezeHandler],
})
/** The lead-freezes feature: whether a customer waits for the owner, and the owner's three answers. */
export class LeadFreezesApiModule extends ConfigurableModuleClass {}
