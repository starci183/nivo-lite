import { Module } from "@nestjs/common"
import { ContractsLinkApiModule } from "../../contracts-link.module"
import { ConfigurableModuleClass } from "./contracts-link-graphql.module-definition"
import { LinkContractCustomersResolver } from "./link-contract-customers.resolver"

@Module({
    imports: [ContractsLinkApiModule.register({})],
    providers: [LinkContractCustomersResolver],
})
/** GraphQL transport for linking imported contracts to their customers. */
export class ContractsLinkGraphqlModule extends ConfigurableModuleClass {}
