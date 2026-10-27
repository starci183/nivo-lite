import { Module } from "@nestjs/common"
import { LinkContractCustomersHandler } from "./application/link-contract-customers.handler"
import { ConfigurableModuleClass } from "./contracts-link.module-definition"

@Module({
    providers: [LinkContractCustomersHandler],
})
/** The contracts-link feature: the handler that ties the contracts of a workspace to their customers. */
export class ContractsLinkApiModule extends ConfigurableModuleClass {}
