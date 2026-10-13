import { Body, Controller, HttpCode, Param, Post } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { DecideExecutionCommand } from "../../application/decide-execution.command"
import { DecideExecutionRequest } from "./dto/decide-execution.request"
import { ExecutionIdRequest } from "./dto/execution-id.request"
import { ExecutionResponse } from "./dto/execution.response"
import { toDecideExecutionRequest, toExecutionResponse } from "./decisions.mapper"

@Controller("decisions/executions")
/** HTTP door of the follow-up approval cards. */
export class ExecutionsController {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Approves (optionally with an edited draft) or rejects an approval card; a card decided already is refused. */
    @Post(":executionId/decision")
    @HttpCode(200)
    async decide(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Param() params: ExecutionIdRequest,
        @Body() input: DecideExecutionRequest,
    ): Promise<ExecutionResponse> {
        const result = await this.commandBus.execute(
            new DecideExecutionCommand({
                request: toDecideExecutionRequest(workspaceId, params.executionId, locale, input),
                principal,
            }),
        )
        return toExecutionResponse(result)
    }
}
