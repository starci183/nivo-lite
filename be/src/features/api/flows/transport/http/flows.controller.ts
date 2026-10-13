import { Body, Controller, Post } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { RunFlowCommand } from "../../application/run-flow.command"
import { RunFlowRequest } from "./dto/run-flow.request"
import { RunFlowResponse } from "./dto/run-flow.response"
import { toFlowRequest, toRunFlowResponse } from "./flows.mapper"

@Controller("flows")
/** HTTP door of the operating flow: authority, rules, staff and the decisions on the work waiting in Office. */
export class FlowsController {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Runs one flow command as the signed-in member; the service admits owners and managers for what changes the rules. */
    @Post("commands")
    async run(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Body() input: RunFlowRequest,
    ): Promise<RunFlowResponse> {
        const result = await this.commandBus.execute(
            new RunFlowCommand({ request: { workspaceId, flow: toFlowRequest(input) }, principal }),
        )
        return toRunFlowResponse(result)
    }
}
