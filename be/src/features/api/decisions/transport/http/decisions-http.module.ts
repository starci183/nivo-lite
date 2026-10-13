import { Module } from "@nestjs/common"
import { DecisionsApiModule } from "../../decisions.module"
import { AuthorityController } from "./authority.controller"
import { CommandsController } from "./commands.controller"
import { ExecutionsController } from "./executions.controller"
import { ResponsibilitiesController } from "./responsibilities.controller"
import { WorkItemsController } from "./work-items.controller"

@Module({
    imports: [DecisionsApiModule],
    controllers: [
        WorkItemsController,
        ExecutionsController,
        CommandsController,
        AuthorityController,
        ResponsibilitiesController,
    ],
})
/** The HTTP transport of the decisions feature. */
export class DecisionsHttpModule {}
