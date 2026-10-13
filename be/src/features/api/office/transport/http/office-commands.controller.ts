import { Body, Controller, Get, HttpCode, Param, Post } from "@nestjs/common"
import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { CancelCommandCommand } from "../../application/cancel-command.command"
import { ConfirmCommandCommand } from "../../application/confirm-command.command"
import { ListCommandCandidatesQuery } from "../../application/list-command-candidates.query"
import { ProposeCommandCommand } from "../../application/propose-command.command"
import { CandidateIdRequest } from "./dto/candidate-id.request"
import { CandidateResponse } from "./dto/candidate.response"
import { ConfirmResultResponse } from "./dto/confirm-result.response"
import { ProposeCommandRequest } from "./dto/propose-command.request"
import { ProposeOutcomeResponse } from "./dto/propose-outcome.response"
import { toCandidatesResponse, toConfirmResultResponse, toProposeOutcomeResponse } from "./office.mapper"

@Controller("office/commands")
/** HTTP doors of the Office composer: command cards proposed from an owner message, then confirmed or cancelled. */
export class OfficeCommandsController {
    constructor(
        @InjectQueryBus() private readonly queryBus: QueryBus,
        @InjectCommandBus() private readonly commandBus: CommandBus,
    ) {}

    /** Lists the command cards of the workspace. */
    @Get()
    async list(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<Array<CandidateResponse>> {
        const result = await this.queryBus.execute(
            new ListCommandCandidatesQuery({ request: { workspaceId }, principal }),
        )
        return toCandidatesResponse(result)
    }

    /** Proposes a command card for an owner message. */
    @Post("propose")
    @HttpCode(200)
    async propose(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Body() input: ProposeCommandRequest,
    ): Promise<ProposeOutcomeResponse> {
        const result = await this.commandBus.execute(
            new ProposeCommandCommand({ request: { workspaceId, messageId: input.messageId, locale }, principal }),
        )
        return toProposeOutcomeResponse(result)
    }

    /** Sends the command of a card to the receiving agent. */
    @Post(":candidateId/confirm")
    @HttpCode(200)
    async confirm(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Param() params: CandidateIdRequest,
    ): Promise<ConfirmResultResponse> {
        const result = await this.commandBus.execute(
            new ConfirmCommandCommand({
                request: { workspaceId, candidateId: params.candidateId, locale },
                principal,
            }),
        )
        return toConfirmResultResponse(result)
    }

    /** Cancels a command card. */
    @Post(":candidateId/cancel")
    @HttpCode(204)
    cancel(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Param() params: CandidateIdRequest,
    ): Promise<void> {
        return this.commandBus.execute(
            new CancelCommandCommand({ request: { workspaceId, candidateId: params.candidateId }, principal }),
        )
    }
}
