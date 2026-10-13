import { Body, Controller, HttpCode, Post } from "@nestjs/common"
import type { CommandBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { SendCommandCommand } from "../../application/send-command.command"
import { CommandResultResponse } from "./dto/command-result.response"
import { SendCommandRequest } from "./dto/send-command.request"
import { toCommandResultResponse, toSendCommandRequest } from "./decisions.mapper"

@Controller("decisions/commands")
/** HTTP door of the agent command bus for the owner and managers. */
export class CommandsController {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Sends a command to an agent; a refusal is answered with its reason, not thrown. */
    @Post()
    @HttpCode(200)
    async send(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Body() input: SendCommandRequest,
    ): Promise<CommandResultResponse> {
        const result = await this.commandBus.execute(
            new SendCommandCommand({ request: toSendCommandRequest(workspaceId, locale, input), principal }),
        )
        return toCommandResultResponse(result)
    }
}
