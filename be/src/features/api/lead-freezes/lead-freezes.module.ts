import { Module } from "@nestjs/common"
import { DecideLeadFreezeHandler } from "./application/decide-lead-freeze.handler"
import { ReadLeadFreezeHandler } from "./application/read-lead-freeze.handler"
import { ConfigurableModuleClass } from "./lead-freezes.module-definition"

@Module({
    providers: [ReadLeadFreezeHandler, DecideLeadFreezeHandler],
})
/** The lead-freezes feature: whether a customer is held by a stop; the answer mutation is a shell (`on_stop` / `not_found`). */
export class LeadFreezesApiModule extends ConfigurableModuleClass {}
