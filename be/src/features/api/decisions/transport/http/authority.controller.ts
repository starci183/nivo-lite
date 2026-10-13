import { Body, Controller, Get, Put } from "@nestjs/common"
import type { CommandBus, QueryBus } from "@nestjs/cqrs"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ReadAuthorityQuery } from "../../application/read-authority.query"
import { SaveRuleCommand } from "../../application/save-rule.command"
import { UpdateAuthorityCommand } from "../../application/update-authority.command"
import { AuthorityProfileResponse, AuthorityRuleResponse, AuthoritySheetResponse } from "./dto/authority.response"
import { SaveRuleRequest } from "./dto/save-rule.request"
import { UpdateAuthorityRequest } from "./dto/update-authority.request"
import {
    toAuthorityProfileResponse,
    toAuthorityRuleResponse,
    toAuthoritySheetResponse,
    toSaveRuleRequest,
    toUpdateAuthorityRequest,
} from "./decisions.mapper"

@Controller("decisions/authority")
/** HTTP doors of the owner authority: goals, house rules and the rule of each action; owner and manager only. */
export class AuthorityController {
    constructor(
        @InjectQueryBus() private readonly queryBus: QueryBus,
        @InjectCommandBus() private readonly commandBus: CommandBus,
    ) {}

    /** Reads the goals, house rules and every rule. */
    @Get()
    async read(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<AuthoritySheetResponse> {
        const result = await this.queryBus.execute(new ReadAuthorityQuery({ request: { workspaceId }, principal }))
        return toAuthoritySheetResponse(result)
    }

    /** Saves the fields of the body over the stored sheet. */
    @Put()
    async update(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Body() input: UpdateAuthorityRequest,
    ): Promise<AuthorityProfileResponse> {
        const result = await this.commandBus.execute(
            new UpdateAuthorityCommand({ request: toUpdateAuthorityRequest(workspaceId, input), principal }),
        )
        return toAuthorityProfileResponse(result)
    }

    /** Saves the rule of one action. */
    @Put("rules")
    async saveRule(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Body() input: SaveRuleRequest,
    ): Promise<AuthorityRuleResponse> {
        const result = await this.commandBus.execute(
            new SaveRuleCommand({ request: toSaveRuleRequest(workspaceId, input), principal }),
        )
        return toAuthorityRuleResponse(result)
    }
}
