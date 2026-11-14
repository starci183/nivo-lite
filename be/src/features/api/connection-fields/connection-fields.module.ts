import { Module } from "@nestjs/common"
import { GetConnectionFieldsHandler } from "./application/get-connection-fields.handler"
import { RunConnectionActionHandler } from "./application/run-connection-action.handler"
import { UpdateConnectionHandler } from "./application/update-connection.handler"
import { ConfigurableModuleClass } from "./connection-fields.module-definition"

@Module({
    providers: [GetConnectionFieldsHandler, UpdateConnectionHandler, RunConnectionActionHandler],
})
/** The generic connection form feature: the declared fields and actions of an account, a change and an action run through the writer of its provider. */
export class ConnectionFieldsApiModule extends ConfigurableModuleClass {}
