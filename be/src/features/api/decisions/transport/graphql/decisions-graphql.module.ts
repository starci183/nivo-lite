import { Module } from "@nestjs/common"
import { DecisionsApiModule } from "../../decisions.module"
import { ApproverDirectoryResolver } from "./approver-directory.resolver"
import { ConfigurableModuleClass } from "./decisions-graphql.module-definition"

@Module({
    imports: [DecisionsApiModule.register({})],
    providers: [ApproverDirectoryResolver],
})
/** The GraphQL transport of the governance door: the approver directory. */
export class DecisionsGraphqlModule extends ConfigurableModuleClass {}
