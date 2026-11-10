import { Module } from "@nestjs/common"
import { LeadFreezesApiModule } from "../../lead-freezes.module"
import { ConfigurableModuleClass } from "./lead-freezes-graphql.module-definition"
import { LeadFreezeResolver } from "./lead-freeze.resolver"

@Module({
    imports: [LeadFreezesApiModule.register({})],
    providers: [LeadFreezeResolver],
})
/** The GraphQL transport of the lead-freezes feature. */
export class LeadFreezesGraphqlModule extends ConfigurableModuleClass {}
