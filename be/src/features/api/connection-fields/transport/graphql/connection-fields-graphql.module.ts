import { Module } from "@nestjs/common"
import { ConnectionFieldsApiModule } from "../../connection-fields.module"
import { ConfigurableModuleClass } from "./connection-fields-graphql.module-definition"
import { GetConnectionFieldsResolver } from "./get-connection-fields.resolver"
import { RunConnectionActionResolver } from "./run-connection-action.resolver"
import { UpdateConnectionResolver } from "./update-connection.resolver"

@Module({
    imports: [ConnectionFieldsApiModule.register({})],
    providers: [GetConnectionFieldsResolver, UpdateConnectionResolver, RunConnectionActionResolver],
})
/** The GraphQL transport of the generic connection form. */
export class ConnectionFieldsGraphqlModule extends ConfigurableModuleClass {}
